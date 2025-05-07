import { DateTime } from 'luxon';
import { isWeekend, isBusinessHours, adjustDateForAuthenticity, generateRandomCommitTimes } from './date-utils';

/**
 * Defines the configuration options for commit scheduling
 */
export interface CommitScheduleOptions {
  // Core scheduling options
  startDate: Date;
  endDate: Date;
  pattern: number[][]; // 2D array representing the contribution pattern

  // Density and distribution options
  density?: number; // 0-1 scale, 1 being most dense
  randomize?: boolean; // Whether to add randomness to commit times
  timezone?: string; // Timezone for commits

  // Authenticity options
  workHoursOnly?: boolean; // Limit to typical work hours (9-5)
  avoidWeekends?: boolean; // Reduce commits on weekends
  maxCommitsPerDay?: number; // Limit commits per day for realism
}

/**
 * Represents a scheduled commit
 */
export interface ScheduledCommit {
  date: DateTime;
  message?: string;
  weight: number; // Intensity value from the pattern (usually 0-4)
}

/**
 * Maps a 2D pattern array to commit dates based on scheduling options
 */
export function mapPatternToSchedule(options: CommitScheduleOptions): ScheduledCommit[] {
  const {
    startDate,
    endDate,
    pattern,
    density = 0.7,
    randomize = true,
    timezone = 'local',
    workHoursOnly = false,
    avoidWeekends = true,
    maxCommitsPerDay = 5
  } = options;

  try {
    console.log(chalk.blue('Mapping pattern to commit schedule...'));

    // Calculate dimensions
    const rows = pattern.length;
    if (rows === 0) {
      throw new Error('Pattern must have at least one row');
    }

    const cols = pattern[0].length;
    if (cols === 0) {
      throw new Error('Pattern must have at least one column');
    }

    // Calculate date range
    const startDt = DateTime.fromJSDate(startDate);
    const endDt = DateTime.fromJSDate(endDate);
    const totalDays = Math.ceil(endDt.diff(startDt, 'days').days);

    if (totalDays < 1) {
      throw new Error('End date must be after start date');
    }

    if (totalDays < rows * cols) {
      console.warn(chalk.yellow(
        `⚠ Warning: Date range (${totalDays} days) is smaller than pattern size (${rows * cols} cells). Some pattern cells will be ignored.`
      ));
    }

    // Calculate days per cell (how many calendar days each cell in the pattern represents)
    const daysPerCell = Math.max(1, Math.floor(totalDays / (rows * cols)));
    console.log(chalk.dim(`Each pattern cell represents ~${daysPerCell} days`));

    const scheduledCommits: ScheduledCommit[] = [];

    // Map each cell in the pattern to commits
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Skip processing if we're beyond the date range
        const cellIndex = row * cols + col;
        if (cellIndex * daysPerCell >= totalDays) {
          break;
        }

        const cellValue = pattern[row][col];
        if (cellValue <= 0) continue; // Skip empty cells

        // Calculate the date for this cell
        const dayOffset = cellIndex * daysPerCell;
        const baseDate = startDt.plus({ days: dayOffset }).toJSDate();

        // Skip weekends if specified
        if (avoidWeekends && isWeekend(baseDate) && Math.random() > 0.3) {
          continue; // 70% chance to skip weekends
        }

        // Determine number of commits for this cell based on cell value and density
        const commitsForCell = Math.min(
          maxCommitsPerDay,
          Math.ceil(cellValue * density * (randomize ? (0.5 + Math.random()) : 1))
        );

        // Generate commit times for this cell
        const commitTimes = generateRandomCommitTimes(
          baseDate,
          commitsForCell,
          workHoursOnly
        );

        // Add commits to schedule
        for (const commitTime of commitTimes) {
          scheduledCommits.push({
            date: commitTime,
            weight: cellValue,
            message: `Commit for pattern cell [${row},${col}]`
          });
        }
      }
    }

    // Sort commits by date
    scheduledCommits.sort((a, b) => a.date.toMillis() - b.date.toMillis());

    console.log(chalk.green(`✓ Generated schedule with ${scheduledCommits.length} commits`));

    return scheduledCommits;
  } catch (error) {
    console.error(chalk.red('Error mapping pattern to schedule:'), error.message);
    throw new Error(`Failed to create commit schedule: ${error.message}`);
  }
}

/**
 * Validates a commit schedule for authenticity issues
 * Returns an array of issues, empty if no issues found
 */
export function checkScheduleAuthenticity(commits: ScheduledCommit[]): string[] {
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

  // Check for unnatural commit hours
  const lateNightCommits = commits.filter(
    c => c.date.hour >= 1 && c.date.hour <= 5
  ).length;

  if (lateNightCommits > commits.length * 0.25) {
    issues.push(`Suspicious pattern: ${lateNightCommits} commits (${Math.round(lateNightCommits/commits.length*100)}%) are between 1-5 AM`);
  }

  return issues;
}
