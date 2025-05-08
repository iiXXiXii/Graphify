import { DateTime } from 'luxon';
import chalk from 'chalk';
// Import only what's needed from shared module with proper type imports
// Removing unused imports: isWeekend, isBusinessHours, adjustDateForAuthenticity, generateRandomCommitTimes
import type { CommitScheduleOptions, ScheduledCommit } from '../../../shared/src/utils/scheduler.js';
import { mapPatternToSchedule as sharedMapPatternToSchedule, checkScheduleAuthenticity as sharedCheckScheduleAuthenticity } from '../../../shared/src/utils/scheduler.js';
// Import from shared module using path alias
import { generateScheduleFromPattern } from '@shared/utils/scheduler.js';

// Re-export interfaces from shared module with 'type' keyword for verbatimModuleSyntax
export type { CommitScheduleOptions, ScheduledCommit };

/**
 * Maps a 2D pattern array to commit dates based on scheduling options
 * Wrapper around shared implementation with additional logging
 */
export function mapPatternToSchedule(options: CommitScheduleOptions): ScheduledCommit[] {
  try {
    console.log(chalk.blue('Mapping pattern to commit schedule...'));

    // Calculate dimensions for logging purposes
    const rows = options.pattern.length;
    const cols = options.pattern[0]?.length || 0;

    // Calculate date range for logging
    const startDt = DateTime.fromJSDate(options.startDate);
    const endDt = DateTime.fromJSDate(options.endDate);
    const totalDays = Math.ceil(endDt.diff(startDt, 'days').days);

    if (totalDays < rows * cols) {
      console.warn(chalk.yellow(
        `⚠ Warning: Date range (${totalDays} days) is smaller than pattern size (${rows * cols} cells). Some pattern cells will be ignored.`
      ));
    }

    // Call shared implementation
    const scheduledCommits = sharedMapPatternToSchedule(options);

    console.log(chalk.green(`✓ Generated schedule with ${scheduledCommits.length} commits`));
    return scheduledCommits;
  } catch (error: unknown) {
    // Properly handle the unknown error type
    const errorMessage = error instanceof Error
      ? error.message
      : 'An unknown error occurred';

    console.error(chalk.red('Error mapping pattern to schedule:'), errorMessage);
    throw new Error(`Failed to create commit schedule: ${errorMessage}`);
  }
}

/**
 * Validates a commit schedule for authenticity issues
 * Wrapper around shared implementation with additional logging
 */
export function checkScheduleAuthenticity(commits: ScheduledCommit[]): string[] {
  return sharedCheckScheduleAuthenticity(commits);
}
