import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DateTime } from 'luxon';
import { RRule, Frequency } from 'rrule';
import { Schedule, Repository, Pattern } from '@prisma/client';

interface CommitScheduleOptions {
  startDate: Date;
  endDate: Date;
  pattern: number[][];
  density: number;
  randomize: boolean;
  timezone: string;
  workHoursOnly: boolean;
  avoidWeekends: boolean;
  maxCommitsPerDay: number;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval?: number;
    count?: number;
    until?: Date;
  };
}

interface ScheduledCommit {
  date: DateTime;
  message?: string;
  weight: number;
  repositoryId: string;
  status: string;
}

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSchedule(userId: number, patternId: number, repositories: Repository[], settings: any): Promise<Schedule> {
    try {
      // Create the schedule record
      const schedule = await this.prisma.schedule.create({
        data: {
          userId,
          patternId,
          repositories: {
            connect: repositories.map(repo => ({ id: repo.id }))
          },
          settings: JSON.stringify(settings),
          status: 'PENDING'
        },
      });

      // Get the pattern data
      const pattern = await this.prisma.pattern.findUnique({
        where: { id: patternId }
      });

      if (!pattern) {
        throw new Error('Pattern not found');
      }

      // Generate the commit schedule
      const commitSchedule = await this.generateCommitSchedule(
        pattern,
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
            repositoryId: commit.repositoryId,
            status: 'PENDING'
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

  async getSchedulesByPattern(patternId: number): Promise<Schedule[]> {
    return this.prisma.schedule.findMany({
      where: { patternId },
      include: {
        pattern: true,
        repositories: true,
        commits: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });
  }

  async getSchedulesByUser(userId: number): Promise<Schedule[]> {
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
            username: true,
            email: true
          }
        }
      }
    });
  }

  async getScheduleById(id: number): Promise<Schedule | null> {
    return this.prisma.schedule.findUnique({
      where: { id },
      include: {
        pattern: true,
        repositories: true,
        commits: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });
  }

  async cancelSchedule(id: number): Promise<Schedule> {
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
      data: { status: 'CANCELLED' }
    });
  }

  private async generateCommitSchedule(
    pattern: Pattern,
    repositories: Repository[],
    settings: CommitScheduleOptions,
    scheduleId: number
  ): Promise<ScheduledCommit[]> {
    try {
      const {
        startDate,
        endDate,
        density,
        randomize,
        timezone,
        workHoursOnly,
        avoidWeekends,
        maxCommitsPerDay,
        recurrence
      } = settings;

      // Parse pattern grid from JSON string
      const patternGrid = JSON.parse(pattern.grid as string) as number[][];

      // Prepare options for commit scheduling algorithm
      const options: CommitScheduleOptions = {
        startDate,
        endDate,
        pattern: patternGrid,
        density,
        randomize,
        timezone,
        workHoursOnly,
        avoidWeekends,
        maxCommitsPerDay,
        recurrence
      };

      const scheduledCommits = this.mapPatternToCommits(options, repositories);

      // Check for authenticity issues
      const issues = this.checkScheduleAuthenticity(scheduledCommits);
      if (issues.length > 0) {
        this.logger.warn(`Authenticity issues detected for schedule ${scheduleId}: ${issues.join(', ')}`);
      }

      return scheduledCommits;
    } catch (error) {
      this.logger.error(`Error generating commit schedule: ${error.message}`, error.stack);
      throw error;
    }
  }

  private mapPatternToCommits(
    options: CommitScheduleOptions,
    repositories: Repository[]
  ): ScheduledCommit[] {
    const {
      startDate,
      endDate,
      pattern,
      density = 0.7,
      randomize = true,
      timezone = 'local',
      workHoursOnly = false,
      avoidWeekends = true,
      maxCommitsPerDay = 5,
      recurrence
    } = options;

    // If recurrence is specified, use RRule to generate dates
    if (recurrence) {
      return this.createRecurringSchedule(options, repositories);
    }

    // Calculate the date range
    const start = DateTime.fromJSDate(startDate).setZone(timezone);
    const end = DateTime.fromJSDate(endDate).setZone(timezone);
    const totalDays = end.diff(start, 'days').days;

    // Calculate pattern dimensions
    const rows = pattern.length;
    const cols = pattern[0]?.length || 0;
    const totalCells = rows * cols;

    // Days per cell (how many calendar days each cell in the pattern represents)
    const daysPerCell = Math.max(1, Math.floor(totalDays / totalCells));

    const scheduledCommits: ScheduledCommit[] = [];

    // Map each cell in the pattern to potential commit dates
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellValue = pattern[row][col];
        if (cellValue <= 0) continue; // Skip empty cells

        // Calculate the date for this cell
        const dayOffset = (row * cols + col) * daysPerCell;
        const baseDate = start.plus({ days: dayOffset });

        // Determine number of commits for this cell based on cell value and density
        const commitsForCell = Math.min(
          maxCommitsPerDay,
          Math.ceil(cellValue * density * (randomize ? (0.5 + Math.random() * 0.5) : 1))
        );

        // Schedule commits for this cell
        for (let i = 0; i < commitsForCell; i++) {
          // Select a random repository for this commit
          const repository = repositories[Math.floor(Math.random() * repositories.length)];

          let commitDate = baseDate.plus({
            days: randomize ? Math.floor(Math.random() * daysPerCell) : 0,
            hours: randomize ? Math.floor(Math.random() * 24) : 12,
            minutes: randomize ? Math.floor(Math.random() * 60) : 0
          });

          // Apply authenticity constraints
          if (workHoursOnly) {
            // Adjust to work hours (9-5)
            if (commitDate.hour < 9 || commitDate.hour > 17) {
              commitDate = commitDate.set({ hour: 9 + Math.floor(Math.random() * 8) });
            }
          }

          // Reduce weekend commits if specified
          if (avoidWeekends && (commitDate.weekday === 6 || commitDate.weekday === 7)) {
            // 70% chance to skip weekend commits
            if (Math.random() < 0.7) continue;
          }

          scheduledCommits.push({
            date: commitDate,
            weight: cellValue,
            message: `Commit for ${pattern.name} at cell [${row},${col}]`,
            repositoryId: repository.id,
            status: 'PENDING'
          });
        }
      }
    }

    // Sort commits by date
    return scheduledCommits.sort((a, b) => a.date.toMillis() - b.date.toMillis());
  }

  private createRecurringSchedule(
    options: CommitScheduleOptions,
    repositories: Repository[]
  ): ScheduledCommit[] {
    if (!options.recurrence) {
      return this.mapPatternToCommits(options, repositories);
    }

    const { recurrence } = options;

    // Map frequency string to RRule frequency
    const frequencyMap: Record<string, Frequency> = {
      'daily': Frequency.DAILY,
      'weekly': Frequency.WEEKLY,
      'monthly': Frequency.MONTHLY
    };

    // Create base rule
    const rule = new RRule({
      freq: frequencyMap[recurrence.frequency],
      interval: recurrence.interval || 1,
      count: recurrence.count,
      until: recurrence.until,
      dtstart: options.startDate
    });

    // Generate recurring dates
    const recurDates = rule.all();

    let allCommits: ScheduledCommit[] = [];

    // For each recurrence, create a schedule
    for (const recurDate of recurDates) {
      // Clone options but update the date range to be based on this recurrence
      const patternLength = options.pattern.length > 0 ? options.pattern[0].length : 1;
      const recurOptions: CommitScheduleOptions = {
        ...options,
        startDate: recurDate,
        endDate: new Date(recurDate.getTime() + (24 * 60 * 60 * 1000 * patternLength))
      };

      // Get commits for this recurrence
      const commits = this.mapPatternToCommits(recurOptions, repositories);
      allCommits = [...allCommits, ...commits];
    }

    return allCommits.sort((a, b) => a.date.toMillis() - b.date.toMillis());
  }

  private checkScheduleAuthenticity(commits: ScheduledCommit[]): string[] {
    const issues: string[] = [];

    // Group commits by day
    const commitsByDay = new Map<string, ScheduledCommit[]>();

    for (const commit of commits) {
      const dayKey = commit.date.toFormat('yyyy-MM-dd');
      if (!commitsByDay.has(dayKey)) {
        commitsByDay.set(dayKey, []);
      }
      commitsByDay.get(dayKey)!.push(commit);
    }

    // Check for too many commits in one day
    for (const [day, dayCommits] of commitsByDay.entries()) {
      if (dayCommits.length > 15) {
        issues.push(`Suspicious pattern: ${dayCommits.length} commits on ${day} (too many in one day)`);
      }
    }

    // Check for commits at exactly the same time
    const commitTimes = new Map<number, number>();
    for (const commit of commits) {
      const timeKey = commit.date.toMillis();
      commitTimes.set(timeKey, (commitTimes.get(timeKey) || 0) + 1);
    }

    for (const [time, count] of commitTimes.entries()) {
      if (count > 1) {
        const dateStr = DateTime.fromMillis(time).toFormat('yyyy-MM-dd HH:mm:ss');
        issues.push(`Suspicious pattern: ${count} commits at exactly the same time (${dateStr})`);
      }
    }

    // Check for uniformly spaced commits (too regular)
    if (commits.length > 3) {
      const intervals: number[] = [];
      for (let i = 1; i < commits.length; i++) {
        intervals.push(commits[i].date.toMillis() - commits[i-1].date.toMillis());
      }

      // Check if all intervals are the same (would be suspicious)
      const allSame = intervals.every(interval => interval === intervals[0]);
      if (allSame && commits.length > 5) {
        issues.push(`Suspicious pattern: ${commits.length} commits are spaced at exactly equal intervals`);
      }
    }

    return issues;
  }

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
        }
      });

      this.logger.log(`Found ${pendingCommits.length} pending commits to execute`);

      for (const commit of pendingCommits) {
        try {
          // Here you would integrate with GitHub API or similar to create actual commits
          // For now, we'll just update the status

          const commitHash = `mock_${Math.random().toString(36).substring(2, 15)}`;

          await this.prisma.commit.update({
            where: { id: commit.id },
            data: {
              status: 'COMPLETED',
              hash: commitHash
            }
          });

          this.logger.log(`Executed commit ${commit.id} for repository ${commit.repository.name}`);
        } catch (commitError) {
          this.logger.error(`Error executing commit ${commit.id}: ${commitError.message}`, commitError.stack);

          // Mark as failed
          await this.prisma.commit.update({
            where: { id: commit.id },
            data: {
              status: 'FAILED'
            }
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error executing scheduled commits: ${error.message}`, error.stack);
      throw error;
    }
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
      data,
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
