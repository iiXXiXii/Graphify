import { DateTime } from 'luxon';
import { RRule, Frequency } from 'rrule';
import { createDateRange, generateRandomCommitTimes, isWeekend, isBusinessHours, adjustDateForAuthenticity } from '../commands/date';
import chalk from 'chalk';

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

  // Recurrence options
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval?: number; // How many units between recurrences
    count?: number; // How many times to repeat
    until?: Date; // When to stop repeating
  };

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
    const dateRange = createDateRange(startDate, endDate);
    const totalDays = dateRange.length;

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
        if (dayOffset >= dateRange.length) continue;

        const baseDate = dateRange[dayOffset];

        // Skip weekends if specified
        if (avoidWeekends && (baseDate.getDay() === 0 || baseDate.getDay() === 6)) {
          continue;
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
    scheduledCommits.sort((a, b) => a.date.getTime() - b.date.getTime());

    console.log(chalk.green(`✓ Generated schedule with ${scheduledCommits.length} commits`));

    return scheduledCommits;
  } catch (error) {
    console.error(chalk.red('Error mapping pattern to schedule:'), error.message);
    throw new Error(`Failed to create commit schedule: ${error.message}`);
  }
}

/**
 * Creates a recurring schedule based on a pattern and recurrence options
 */
export function createRecurringSchedule(options: CommitScheduleOptions): ScheduledCommit[] {
  if (!options.recurrence) {
    return mapPatternToSchedule(options);
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
    const recurOptions: CommitScheduleOptions = {
      ...options,
      startDate: recurDate,
      endDate: new Date(recurDate.getTime() + (24 * 60 * 60 * 1000 * pattern[0].length))
    };

    // Get commits for this recurrence
    const commits = mapPatternToSchedule(recurOptions);
    allCommits = [...allCommits, ...commits];
  }

  return allCommits.sort((a, b) => a.date.toMillis() - b.date.toMillis());
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

  return issues;
}

/**
 * Validates a pattern grid for potential issues
 */
export function validatePattern(pattern: number[][]): string[] {
  const issues: string[] = [];

  // Check for empty pattern
  if (!pattern || pattern.length === 0) {
    issues.push('Pattern is empty');
    return issues;
  }

  // Check first row length
  const firstRowLength = pattern[0].length;
  if (firstRowLength === 0) {
    issues.push('Pattern has empty rows');
    return issues;
  }

  // Check for rectangular shape (all rows have same length)
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i].length !== firstRowLength) {
      issues.push(`Row ${i + 1} has different length (${pattern[i].length}) than first row (${firstRowLength})`);
    }
  }

  // Check for valid intensity values (0-4)
  for (let row = 0; row < pattern.length; row++) {
    for (let col = 0; col < pattern[row].length; col++) {
      const value = pattern[row][col];
      if (!Number.isInteger(value) || value < 0 || value > 4) {
        issues.push(`Invalid intensity value ${value} at position [${row},${col}]. Values must be integers from 0-4.`);
      }
    }
  }

  // Warning if pattern is too large
  if (pattern.length * firstRowLength > 365) {
    issues.push(`Pattern is very large (${pattern.length} × ${firstRowLength} = ${pattern.length * firstRowLength} cells). This may create a lot of commits.`);
  }

  return issues;
}

/**
 * Check for suspicious patterns that might look unnatural
 */
export function checkScheduleAuthenticity(commits: ScheduledCommit[]): string[] {
  const issues: string[] = [];

  // Group commits by day
  const commitsByDay = new Map<string, ScheduledCommit[]>();

  for (const commit of commits) {
    const dayKey = commit.date.toISOString().split('T')[0];
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
    const timeKey = commit.date.getTime();
    commitTimes.set(timeKey, (commitTimes.get(timeKey) || 0) + 1);
  }

  for (const [time, count] of commitTimes.entries()) {
    if (count > 1) {
      const dateStr = new Date(time).toISOString();
      issues.push(`Suspicious pattern: ${count} commits at exactly the same time (${dateStr})`);
    }
  }

  // Check for uniformly spaced commits (too regular)
  if (commits.length > 3) {
    const intervals: number[] = [];
    for (let i = 1; i < commits.length; i++) {
      intervals.push(commits[i].date.getTime() - commits[i-1].date.getTime());
    }

    // Check if all intervals are the same (would be suspicious)
    const firstInterval = intervals[0];
    const allSame = intervals.every(interval => Math.abs(interval - firstInterval) < 1000); // within 1 second

    if (allSame && commits.length > 5) {
      issues.push(`Suspicious pattern: ${commits.length} commits are spaced at exactly equal intervals`);
    }
  }

  // Check for unnatural commit hours
  const lateNightCommits = commits.filter(
    c => c.date.getHours() >= 1 && c.date.getHours() <= 5
  ).length;

  if (lateNightCommits > commits.length * 0.25) {
    issues.push(`Suspicious pattern: ${lateNightCommits} commits (${Math.round(lateNightCommits/commits.length*100)}%) are between 1-5 AM`);
  }

  return issues;
}

/**
 * Creates a simple pattern (rectangle, heart, letter etc)
 * @param type - Type of pattern to create
 * @param options - Options for pattern creation
 * @returns A 2D array pattern
 */
export function createSimplePattern(
  type: 'rectangle' | 'heart' | 'letter' | 'sine' | 'random',
  options: {
    width?: number;
    height?: number;
    intensity?: number;
    letter?: string;
    randomness?: number;
  } = {}
): number[][] {
  const width = options.width || 7;
  const height = options.height || 7;
  const intensity = options.intensity || 2;
  const randomness = options.randomness || 0;

  // Initialize empty pattern
  const pattern: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));

  switch (type) {
    case 'rectangle':
      // Fill the entire rectangle with the specified intensity
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          pattern[i][j] = intensity;
        }
      }
      break;

    case 'heart':
      // Create a heart shape (basic algorithm)
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      const size = Math.min(centerX, centerY) - 1;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const normalizedX = (x - centerX) / size;
          const normalizedY = (y - centerY) / size;

          // Heart curve formula
          const isInHeart = Math.pow(normalizedX, 2) + Math.pow(normalizedY - 0.4 * Math.sqrt(Math.abs(normalizedX)), 2) <= 0.5;

          if (isInHeart) {
            pattern[y][x] = intensity;
          }
        }
      }
      break;

    case 'letter':
      // Create a simple representation of a letter
      const letter = (options.letter || 'G').toUpperCase();

      // Define a simple 5x5 grid for each letter
      const letterPatterns: Record<string, number[][]> = {
        'A': [
          [0,1,1,0,0],
          [1,0,0,1,0],
          [1,1,1,1,0],
          [1,0,0,1,0],
          [1,0,0,1,0]
        ],
        'G': [
          [0,1,1,1,0],
          [1,0,0,0,0],
          [1,0,1,1,0],
          [1,0,0,1,0],
          [0,1,1,0,0]
        ],
        'H': [
          [1,0,0,1,0],
          [1,0,0,1,0],
          [1,1,1,1,0],
          [1,0,0,1,0],
          [1,0,0,1,0]
        ],
        // Add more letters as needed
      };

      // Use the letter pattern or default to a box
      const letterPattern = letterPatterns[letter] || [
        [1,1,1,0,0],
        [1,0,0,0,0],
        [1,1,1,0,0],
        [1,0,0,0,0],
        [1,1,1,0,0]
      ];

      // Center the letter in the pattern
      const letterHeight = letterPattern.length;
      const letterWidth = letterPattern[0].length;

      const offsetY = Math.floor((height - letterHeight) / 2);
      const offsetX = Math.floor((width - letterWidth) / 2);

      for (let i = 0; i < letterHeight; i++) {
        for (let j = 0; j < letterWidth; j++) {
          if (i + offsetY >= 0 && i + offsetY < height && j + offsetX >= 0 && j + offsetX < width) {
            pattern[i + offsetY][j + offsetX] = letterPattern[i][j] ? intensity : 0;
          }
        }
      }
      break;

    case 'sine':
      // Create a sine wave pattern
      for (let x = 0; x < width; x++) {
        // Calculate sine y position, centered and scaled
        const amplitude = height * 0.4;
        const frequency = 2 * Math.PI / width;
        const y = Math.floor(height / 2 + amplitude * Math.sin(frequency * x));

        if (y >= 0 && y < height) {
          pattern[y][x] = intensity;

          // Add some thickness to the line
          if (y + 1 < height) pattern[y + 1][x] = intensity;
          if (y - 1 >= 0) pattern[y - 1][x] = intensity;
        }
      }
      break;

    case 'random':
      // Create a random pattern with varied intensities
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          // Random value between 0-4
          pattern[i][j] = Math.floor(Math.random() * 5);
        }
      }
      break;
  }

  // Add randomness if specified
  if (randomness > 0) {
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if (Math.random() < randomness) {
          // Either add or remove intensity randomly
          pattern[i][j] = Math.min(4, Math.max(0, pattern[i][j] + (Math.random() < 0.5 ? -1 : 1)));
        }
      }
    }
  }

  return pattern;
}
