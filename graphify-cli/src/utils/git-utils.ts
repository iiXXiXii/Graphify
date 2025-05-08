import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as util from 'util';
import chalk from 'chalk';

const execAsync = util.promisify(exec);

export interface CommitOptions {
  date: Date;
  message: string;
  createEmptyCommit?: boolean;
}

/**
 * Executes git operations to create a commit with a specific date
 */
export async function executeGitOperations(
  date: Date,
  message: string,
  createEmptyCommit: boolean = false
): Promise<void> {
  try {
    // Format the date as expected by Git
    const formattedDate = date.toUTCString();

    if (createEmptyCommit) {
      // Create an empty commit
      await execGitCommand(
        `git commit --allow-empty -m "${escapeShellArg(message)}" --date="${formattedDate}" --quiet`
      );
    } else {
      // Create a temporary file to commit
      const tempFile = await createTempFile();

      try {
        // Stage and commit the file
        await execGitCommand(`git add "${tempFile}"`);
        await execGitCommand(
          `git commit -m "${escapeShellArg(message)}" --date="${formattedDate}" --quiet`
        );
      } finally {
        // Clean up the temporary file
        await fs.unlink(tempFile).catch(() => {
          // Ignore cleanup errors
        });
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create commit: ${errorMessage}`);
  }
}

/**
 * Executes multiple commits based on a schedule
 */
export async function executeScheduledCommits(
  commits: CommitOptions[]
): Promise<void> {
  if (!commits || commits.length === 0) {
    throw new Error('No commits scheduled');
  }

  // Ensure we're in a git repository
  await checkGitRepository();

  console.log(chalk.blue(`Starting scheduled commits (${commits.length} total)...`));

  // Sort commits by date
  const sortedCommits = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());

  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  // Process each commit
  for (let i = 0; i < sortedCommits.length; i++) {
    const commit = sortedCommits[i];
    const { date, message, createEmptyCommit = true } = commit;

    try {
      // Show progress
      const progressPercent = Math.round((i / sortedCommits.length) * 100);
      process.stdout.write(
        `\rProcessing commit ${i + 1}/${sortedCommits.length} (${progressPercent}%)`
      );

      // Execute the commit
      await executeGitOperations(date, message, createEmptyCommit);
      successCount++;
    } catch (error: unknown) {
      failureCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Commit ${i + 1}: ${errorMessage}`);

      // Don't flood the console with errors
      if (errors.length === 5 && sortedCommits.length > 10) {
        errors.push('... more errors omitted ...');
        break;
      }
    }
  }

  // Clear the progress line
  process.stdout.write('\r' + ' '.repeat(80) + '\r');

  // Print summary
  console.log(chalk.green(`\n✓ Completed: ${successCount} commits created successfully`));

  if (failureCount > 0) {
    console.log(chalk.yellow(`⚠ Warning: ${failureCount} commits failed`));

    if (errors.length > 0) {
      console.log(chalk.yellow('\nErrors:'));
      errors.forEach(err => console.log(chalk.dim(`- ${err}`)));
    }
  }
}

/**
 * Push commits to GitHub repository
 */
export async function pushToGitHub(branch: string = 'main'): Promise<void> {
  try {
    console.log(chalk.blue(`Pushing commits to GitHub (${branch})...`));

    // Check authentication before pushing
    const { stdout: remoteUrl } = await execGitCommand('git remote get-url origin');

    if (!remoteUrl.trim().includes('github.com')) {
      throw new Error(
        'Remote repository is not on GitHub. Please push manually: git push origin ' + branch
      );
    }

    // Push to remote
    await execGitCommand(`git push origin ${branch} --quiet`);

    console.log(chalk.green('✓ Successfully pushed commits to GitHub'));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Authentication failed')) {
      throw new Error(
        'GitHub authentication failed. Please check your credentials or authenticate with "graphify auth".'
      );
    }
    throw new Error(`Failed to push to GitHub: ${errorMessage}`);
  }
}

/**
 * Check if the current directory is a Git repository
 */
async function checkGitRepository(): Promise<void> {
  try {
    await execGitCommand('git rev-parse --is-inside-work-tree');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      'Not a git repository. Please run "git init" first or navigate to a valid git repository.'
    );
  }

  // Also check that the repo has at least one commit
  try {
    await execGitCommand('git rev-parse HEAD');
  } catch (error: unknown) {
    // No commits yet, suggest creating an initial commit
    throw new Error(
      'Git repository has no commits. Please create an initial commit first with: git commit --allow-empty -m "Initial commit"'
    );
  }
}

/**
 * Create a temporary file for committing
 */
async function createTempFile(): Promise<string> {
  const timestamp = new Date().getTime();
  const tempDir = path.join(os.tmpdir(), 'graphify');

  // Ensure temp directory exists
  await fs.mkdir(tempDir, { recursive: true });

  // Create a unique file name
  const filePath = path.join(tempDir, `commit-${timestamp}.txt`);

  // Write random content to the file
  await fs.writeFile(
    filePath,
    `Generated by Graphify CLI\nTimestamp: ${timestamp}\nRandom: ${Math.random()}\n`
  );

  return filePath;
}

interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Execute a Git command with error handling
 */
async function execGitCommand(command: string): Promise<ExecResult> {
  try {
    const result = await execAsync(command);
    return result;
  } catch (error: unknown) {
    // Extract useful information from the error
    if (error && typeof error === 'object' && 'stderr' in error) {
      const gitError = error as { stderr?: string, message?: string };
      const errorMsg = gitError.stderr || gitError.message || 'Unknown Git error';

      // Enhance error messages for common Git errors
      if (errorMsg.includes('not a git repository')) {
        throw new Error('Not in a git repository. Please run "git init" first.');
      }
      if (errorMsg.includes('Authentication failed')) {
        throw new Error('GitHub authentication failed. Try running "graphify auth" first.');
      }
      if (errorMsg.includes('Permission denied')) {
        throw new Error('Permission denied. Check your GitHub access rights.');
      }

      // Generic error
      throw new Error(`Git error: ${errorMsg.trim()}`);
    }

    // Fallback error handling
    throw new Error(`Git command failed: ${String(error)}`);
  }
}

/**
 * Escape string for shell command arguments
 */
function escapeShellArg(arg: string): string {
  // Replace double quotes with escaped double quotes
  return arg.replace(/"/g, '\\"');
}

// Fix the type errors with CommitOptions properties
export async function createCommit(options?: CommitOptions): Promise<void> {
  const { execCmd } = await import('./commandExecutor.js');

  try {
    // Set environment variables for backdating
    if (options && options.date) {
      process.env.GIT_AUTHOR_DATE = options.date.toISOString();
      process.env.GIT_COMMITTER_DATE = options.date.toISOString();
    }

    const args = ['commit'];

    // Add message if provided
    if (options && options.message) {
      args.push('-m', options.message);
    } else {
      args.push('-m', 'Update documentation');
    }

    // Handle empty commits
    if (options && options.createEmptyCommit) {
      args.push('--allow-empty');
    }

    // Execute the commit command
    await execCmd('git', args);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during git commit';
    throw new Error(`Git commit failed: ${errorMessage}`);
  } finally {
    // Clean up environment variables
    delete process.env.GIT_AUTHOR_DATE;
    delete process.env.GIT_COMMITTER_DATE;
  }
}
