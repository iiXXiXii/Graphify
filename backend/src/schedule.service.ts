import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DateTime } from 'luxon';
import { RRule, Frequency } from 'rrule';
import { Schedule, Repository, Pattern, Commit } from '@prisma/client';
import { Octokit } from '@octokit/rest';
import {
  CommitScheduleOptions,
  ScheduledCommit,
  mapPatternToSchedule,
  checkScheduleAuthenticity,
  processBatchedCommits
} from '@graphify/shared';

// Interface for schedule creation with repositories
interface ScheduleCreateWithRepositories {
  userId: string;
  patternId: string;
  repositories: Repository[];
  settings: CommitScheduleOptions;
}

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);
  private readonly GITHUB_API_INTERVAL_MS = 1000; // 1 second between API calls to avoid rate limiting

  constructor(private readonly prisma: PrismaService) {}

  async createSchedule(userId: string, patternId: string, repositories: Repository[], settings: CommitScheduleOptions): Promise<Schedule> {
    try {
      // First verify the pattern exists
      const pattern = await this.prisma.pattern.findUnique({
        where: { id: patternId }
      });

      if (!pattern) {
        throw new Error('Pattern not found');
      }

      // Create the schedule record after confirming pattern exists
      const schedule = await this.prisma.schedule.create({
        data: {
          userId,
          patternId,
          status: 'PENDING',
          settings: JSON.stringify(settings),
          startDate: settings.startDate,
          endDate: settings.endDate,
          active: true,
        }
      });

      // Create repository connections
      for (const repo of repositories) {
        await this.prisma.schedule.update({
          where: { id: schedule.id },
          data: {
            repositories: {
              connect: { id: repo.id }
            }
          }
        });
      }

      // Generate the commit schedule
      const commitSchedule = await this.generateCommitSchedule(
        pattern as unknown as Pattern,
        repositories,
        settings,
        schedule.id
      );

      // Create commit records
      for (const commit of commitSchedule) {
        await this.prisma.commit.create({
          data: {
            scheduleId: schedule.id,
            message: commit.message || `Commit for pattern ${pattern.name}`,
            date: commit.date.toJSDate(),
            repositoryId: commit.repositoryId as string,
            status: 'PENDING',
            userId // Add the user ID for the commit
          }
        });
      }

      // Update schedule status
      return this.prisma.schedule.update({
        where: { id: schedule.id },
        data: { status: 'SCHEDULED' }
      });
    } catch (error) {
      this.logger.error(`Error creating schedule: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getSchedulesByPattern(patternId: string): Promise<Schedule[]> {
    return this.prisma.schedule.findMany({
      where: { patternId },
      include: {
        pattern: true,
        repositories: true,
        commits: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
  }

  async getSchedulesByUser(userId: string): Promise<Schedule[]> {
    return this.prisma.schedule.findMany({
      where: { userId },
      include: {
        pattern: true,
        repositories: true,
        commits: {
          take: 10, // Limit to most recent commits
          orderBy: { date: 'desc' }
        },
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
  }

  async getScheduleById(id: string): Promise<Schedule | null> {
    return this.prisma.schedule.findUnique({
      where: { id },
      include: {
        pattern: true,
        repositories: true,
        commits: true,
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
  }

  async cancelSchedule(id: string): Promise<Schedule> {
    // Cancel any pending commits
    await this.prisma.commit.updateMany({
      where: {
        scheduleId: id,
        status: 'PENDING'
      },
      data: {
        status: 'CANCELLED'
      }
    });

    // Update schedule status
    return this.prisma.schedule.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        active: false
      }
    });
  }

  /**
   * Generates scheduled commits for the given pattern, repositories, and settings
   * Uses the shared utility functions from @graphify/shared
   */
  private async generateCommitSchedule(
    pattern: Pattern,
    repositories: Repository[],
    settings: CommitScheduleOptions,
    scheduleId: string
  ): Promise<ScheduledCommit[]> {
    try {
      // Parse pattern grid from JSON string
      const patternGrid = JSON.parse(pattern.grid as string) as number[][];

      // Prepare options for commit scheduling algorithm
      const options: CommitScheduleOptions = {
        ...settings,
        pattern: patternGrid,
      };

      // Use the shared utility to map pattern to commit schedule
      let scheduledCommits: ScheduledCommit[] = mapPatternToSchedule(options);

      // Assign repositories to commits
      scheduledCommits = scheduledCommits.map(commit => ({
        ...commit,
        repositoryId: repositories[Math.floor(Math.random() * repositories.length)].id,
        status: 'PENDING'
      }));

      // Check for authenticity issues using the shared utility
      const issues = checkScheduleAuthenticity(scheduledCommits);

      if (issues.length > 0) {
        this.logger.warn(`Authenticity issues detected for schedule ${scheduleId}: ${issues.join(', ')}`);
      }

      return scheduledCommits;
    } catch (error) {
      this.logger.error(`Error generating commit schedule: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Executes all pending scheduled commits
   */
  async executeScheduledCommits(): Promise<void> {
    try {
      // Find all pending commits that are due
      const pendingCommits = await this.prisma.commit.findMany({
        where: {
          status: 'PENDING',
          date: {
            lte: new Date() // Commits due now or in the past
          }
        },
        include: {
          repository: true,
          schedule: {
            include: {
              user: true
            }
          }
        },
        orderBy: {
          date: 'asc' // Process oldest commits first
        },
        take: 100 // Process in larger batches since we're using efficient batch processing
      });

      this.logger.log(`Found ${pendingCommits.length} pending commits to execute`);

      // Group commits by user for better token management and rate limiting
      const commitsByUser = this.groupCommitsByUser(pendingCommits);

      // Process each user's commits with improved batch processing
      for (const [userId, userCommits] of commitsByUser.entries()) {
        // Get the most recent valid GitHub token for this user
        const authSession = await this.prisma.authSession.findFirst({
          where: {
            userId: userId,
            provider: 'github',
            expiresAt: { gt: new Date() } // Only get valid tokens
          },
          orderBy: {
            createdAt: 'desc' // Get the most recent session
          }
        });

        if (!authSession) {
          this.logger.error(`No valid GitHub token found for user ${userId}`);
          await this.markCommitsAsFailed(userCommits, 'No valid GitHub token found');
          continue;
        }

        const token = authSession.accessToken;
        const octokit = new Octokit({
          auth: token,
          throttle: {
            onRateLimit: (retryAfter, options, octokit, retryCount) => {
              this.logger.warn(`Request quota exhausted for request ${options.method} ${options.url}`);

              // Retry twice
              if (retryCount < 2) {
                this.logger.log(`Retrying after ${retryAfter} seconds!`);
                return true;
              }
            },
            onSecondaryRateLimit: (retryAfter, options, octokit) => {
              this.logger.warn(`Secondary rate limit detected for request ${options.method} ${options.url}`);
              return true; // Retry with exponential backoff
            }
          }
        });

        // Use the shared batch processing utility to handle commits with proper rate limiting
        const results = await processBatchedCommits(
          userCommits,
          async (commit) => {
            await this.executeCommit(commit, octokit);
          },
          {
            batchSize: 5, // Process 5 commits in parallel
            delayBetweenItems: 1000, // 1 second between items
            delayBetweenBatches: 5000, // 5 seconds between batches
            onProgress: (processed, total) => {
              this.logger.log(`Progress: ${processed}/${total} commits processed for user ${userId}`);
            }
          }
        );

        // Log the results
        this.logger.log(`Processed ${results.succeeded} commits successfully for user ${userId}`);
        if (results.failed > 0) {
          this.logger.warn(`Failed to process ${results.failed} commits for user ${userId}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error executing scheduled commits: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Group commits by user ID
  private groupCommitsByUser(commits: any[]): Map<string, any[]> {
    const commitsByUser = new Map<string, any[]>();

    for (const commit of commits) {
      const userId = commit.schedule.user.id;
      if (!commitsByUser.has(userId)) {
        commitsByUser.set(userId, []);
      }
      commitsByUser.get(userId)!.push(commit);
    }

    return commitsByUser;
  }

  // Execute a single commit
  private async executeCommit(commit: any, octokit: Octokit): Promise<void> {
    const { repository } = commit;
    const user = commit.schedule.user;

    // Extract owner and repo from repository fullName (format: owner/repo)
    const [owner, repo] = repository.fullName.split('/');

    try {
      // Get the default branch
      const { data: repoData } = await octokit.repos.get({
        owner,
        repo
      });
      const defaultBranch = repoData.default_branch;

      // Get the latest commit on the default branch
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`
      });
      const latestCommitSha = refData.object.sha;

      // Get the commit to get the tree
      const { data: latestCommit } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: latestCommitSha
      });

      // Create a new blob with some content
      const timestamp = new Date(commit.date).toISOString();
      const content = `# Graphify Commit\n\nThis commit was automatically generated by Graphify on ${timestamp}\n\nPattern: ${commit.schedule.pattern?.name || 'Unknown'}\n`;

      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: Buffer.from(content).toString('base64'),
        encoding: 'base64'
      });

      // Create a new tree with the blob
      const { data: tree } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: latestCommit.tree.sha,
        tree: [
          {
            path: `graphify-${new Date(commit.date).getTime()}.md`,
            mode: '100644',
            type: 'blob',
            sha: blob.sha
          }
        ]
      });

      // Create a commit with the new tree
      const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message: commit.message,
        tree: tree.sha,
        parents: [latestCommitSha],
        author: {
          name: user.name || user.githubLogin || user.email,
          email: user.email || `${user.githubLogin || user.id}@users.noreply.github.com`,
          date: new Date(commit.date).toISOString() // Use the scheduled date for the commit
        },
        committer: {
          name: user.name || user.githubLogin || user.email,
          email: user.email || `${user.githubLogin || user.id}@users.noreply.github.com`,
          date: new Date(commit.date).toISOString()
        }
      });

      // Update the reference to point to the new commit
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${defaultBranch}`,
        sha: newCommit.sha,
        force: false // Don't force push - safer
      });

      // Mark the commit as completed in our database
      await this.prisma.commit.update({
        where: { id: commit.id },
        data: {
          status: 'COMPLETED',
          hash: newCommit.sha
        }
      });

      this.logger.log(`Executed commit ${commit.id} for repository ${repository.name} with hash ${newCommit.sha}`);

      // Create a log entry
      await this.prisma.log.create({
        data: {
          type: 'GIT_COMMIT',
          message: `Created commit in ${repository.fullName}`,
          details: {
            commitHash: newCommit.sha,
            repository: repository.fullName,
            scheduledDate: commit.date
          },
          userId: user.id,
          scheduleId: commit.schedule.id
        }
      });
    } catch (error) {
      // Let the error propagate to be handled by the calling method
      throw error;
    }
  }

  // Mark a batch of commits as failed
  private async markCommitsAsFailed(commits: any[], reason: string): Promise<void> {
    for (const commit of commits) {
      await this.prisma.commit.update({
        where: { id: commit.id },
        data: { status: 'FAILED' }
      });

      await this.prisma.log.create({
        data: {
          type: 'ERROR',
          message: `Failed to create commit: ${reason}`,
          details: {
            commitId: commit.id,
            repository: commit.repository.fullName,
            scheduledDate: commit.date,
            reason
          },
          success: false,
          userId: commit.schedule.user.id,
          scheduleId: commit.schedule.id
        }
      });
    }
  }

  // Helper method to create controlled delays
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async findAllByPatternId(patternId: string) {
    return this.prisma.schedule.findMany({
      where: { patternId },
      include: { pattern: true }
    });
  }

  async findById(id: string) {
    return this.prisma.schedule.findUnique({
      where: { id },
      include: { pattern: true }
    });
  }

  async create(data: {
    patternId: string;
    startDate: Date;
    endDate?: Date;
    commitCount?: number;
    userId: string;
    days?: number[];
    active?: boolean;
  }) {
    // First verify user owns the pattern
    const pattern = await this.prisma.pattern.findFirst({
      where: {
        id: data.patternId,
        userId: data.userId
      }
    });

    if (!pattern) {
      throw new Error('Pattern not found or you do not have permission');
    }

    return this.prisma.schedule.create({
      data: {
        patternId: data.patternId,
        userId: data.userId,
        startDate: data.startDate,
        endDate: data.endDate,
        commitCount: data.commitCount || 1,
        days: data.days || [0, 1, 2, 3, 4, 5, 6], // Default to all days
        active: data.active !== undefined ? data.active : true,
      },
      include: { pattern: true }
    });
  }

  async update(id: string, userId: string, data: {
    startDate?: Date;
    endDate?: Date | null;
    commitCount?: number;
    days?: number[];
    active?: boolean;
  }) {
    // First verify user owns the pattern associated with this schedule
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: { pattern: true }
    });

    if (!schedule || schedule.pattern.userId !== userId) {
      throw new Error('Schedule not found or you do not have permission');
    }

    return this.prisma.schedule.update({
      where: { id },
      data: {
        startDate: data.startDate,
        endDate: data.endDate,
        commitCount: data.commitCount,
        days: data.days,
        active: data.active
      },
      include: { pattern: true }
    });
  }

  async delete(id: string, userId: string) {
    // First verify user owns the pattern associated with this schedule
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: { pattern: true }
    });

    if (!schedule || schedule.pattern.userId !== userId) {
      throw new Error('Schedule not found or you do not have permission');
    }

    return this.prisma.schedule.delete({
      where: { id }
    });
  }

  async getActiveSchedules() {
    const now = new Date();

    return this.prisma.schedule.findMany({
      where: {
        active: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ],
      },
      include: { pattern: true }
    });
  }
}
