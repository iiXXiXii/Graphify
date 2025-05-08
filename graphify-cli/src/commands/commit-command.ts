import { Command } from 'commander';
import { promises as fs } from 'fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { isAuthenticated } from '../auth/index.js';
// Import from shared module with explicit file extensions
import { validateDateInput, formatDate, adjustDateForAuthenticity } from '../../../shared/src/utils/date-utils.js';
import { executeScheduledCommits, pushToGitHub } from '../utils/git-utils.js';
// Import from shared module with explicit file extensions
import { validatePattern } from '../../../shared/src/utils/pattern-utils.js';
import { mapPatternToSchedule, checkScheduleAuthenticity } from '../utils/scheduler.js';

export function setupCommitCommand(program: Command): void {
  const commitCommand = program
    .command('commit')
    .description('Generate backdated commits based on a pattern');

  commitCommand
    .option('-p, --pattern <file>', 'Path to pattern file (JSON)')
    .option('-s, --start-date <date>', 'Start date for the commit pattern (YYYY-MM-DD)')
    .option('-e, --end-date <date>', 'End date for the commit pattern (YYYY-MM-DD)')
    .option('-d, --density <number>', 'Commit density factor (0.0-1.0)')
    .option('-m, --message <string>', 'Custom commit message template')
    .option('--dry-run', 'Preview commits without actually creating them')
    .option('--work-hours-only', 'Only create commits during typical work hours (9-5)')
    .option('--avoid-weekends', 'Reduce commit frequency on weekends', true)
    .option('--randomize', 'Add randomness to commit times for more natural patterns', true)
    .option('--push', 'Push commits to remote after creation')
    .action(async (options) => {
      try {
        // Check authentication
        const authenticated = await isAuthenticated();
        if (!authenticated) {
          console.log(chalk.yellow('⚠ Not authenticated with GitHub.'));
          const { shouldAuth } = await inquirer.prompt({
            type: 'confirm',
            name: 'shouldAuth',
            message: 'Would you like to authenticate now?',
            default: true
          });

          if (shouldAuth) {
            // Import dynamically to avoid circular dependency
            const { authenticateWithGitHub } = await import('../auth/index.js');
            await authenticateWithGitHub();
          } else {
            console.log(chalk.yellow('⚠ Continuing without authentication. Some features may be limited.'));
          }
        }

        // Get or prompt for pattern
        let pattern: number[][] = [];
        if (options.pattern) {
          try {
            const patternData = await fs.readFile(options.pattern, 'utf-8');
            const parsedData = JSON.parse(patternData);

            // Handle different pattern formats
            if (Array.isArray(parsedData)) {
              // Direct array format
              pattern = Array.isArray(parsedData[0]) ? parsedData : [parsedData];
            } else if (parsedData.pattern) {
              // Object with pattern property
              pattern = Array.isArray(parsedData.pattern[0]) ? parsedData.pattern : [parsedData.pattern];
            } else {
              throw new Error('Invalid pattern format. Expected 2D array or object with pattern property.');
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(chalk.red('Failed to load pattern file:'), errorMessage);

            const { createNew } = await inquirer.prompt({
              type: 'confirm',
              name: 'createNew',
              message: 'Would you like to create a simple pattern instead?',
              default: true
            });

            if (createNew) {
              pattern = await promptForPattern();
            } else {
              process.exit(1);
            }
          }
        } else {
          // Create a simple default pattern
          pattern = await promptForPattern();
        }

        // Validate pattern
        const patternIssues = validatePattern(pattern);
        if (patternIssues.length > 0) {
          console.log(chalk.yellow('⚠ Pattern validation issues:'));
          patternIssues.forEach(issue => console.log(chalk.dim(`  - ${issue}`)));

          const { continueAnyway } = await inquirer.prompt({
            type: 'confirm',
            name: 'continueAnyway',
            message: 'Continue anyway?',
            default: patternIssues.some(i => i.includes('Invalid')) ? false : true
          });

          if (!continueAnyway) {
            process.exit(1);
          }
        }

        // Get or prompt for start date
        const startDate = options.startDate
          ? validateDateInput(options.startDate)
          : await promptForDate('Enter start date (YYYY-MM-DD):', true);

        // Get or prompt for end date
        const endDate = options.endDate
          ? validateDateInput(options.endDate)
          : await promptForDate('Enter end date (YYYY-MM-DD):', false);

        // Get or prompt for density
        const density = options.density
          ? parseFloat(options.density)
          : await promptForDensity();

        // Create commit schedule options
        const scheduleOptions = {
          pattern,
          startDate,
          endDate,
          density,
          randomize: options.randomize,
          workHoursOnly: options.workHoursOnly,
          avoidWeekends: options.avoidWeekends
        };

        // Generate commit schedule
        const scheduledCommits = mapPatternToSchedule(scheduleOptions);

        // Check for authenticity issues
        const authenticityIssues = checkScheduleAuthenticity(scheduledCommits);
        if (authenticityIssues.length > 0) {
          console.log(chalk.yellow('\n⚠ Authenticity check warnings:'));
          authenticityIssues.forEach(issue => console.log(chalk.dim(`  - ${issue}`)));

          const { continueWithIssues } = await inquirer.prompt({
            type: 'confirm',
            name: 'continueWithIssues',
            message: 'This pattern may look unnatural on your GitHub contribution graph. Continue anyway?',
            default: false
          });

          if (!continueWithIssues) {
            console.log(chalk.blue('Aborting operation. Try adjusting the density or date range.'));
            process.exit(0);
          }
        }

        // Display preview
        console.log(chalk.blue('\n📅 Commit Schedule Preview:'));
        console.log(`Total commits: ${chalk.bold(scheduledCommits.length.toString())}`);
        console.log(`Date range: ${chalk.bold(formatDate(startDate))} to ${chalk.bold(formatDate(endDate))}`);
        console.log(`Density factor: ${chalk.bold(density.toString())}`);

        // Show sample of commits
        const sampleSize = Math.min(5, scheduledCommits.length);
        console.log(chalk.dim('\nSample of scheduled commits:'));
        for (let i = 0; i < sampleSize; i++) {
          const commit = scheduledCommits[i];
          console.log(chalk.dim(`  - ${formatDate(commit.date.toJSDate())} at ${commit.date.toFormat('HH:mm:ss')}: Intensity ${commit.weight}`));
        }

        if (scheduledCommits.length > sampleSize) {
          console.log(chalk.dim(`  ... and ${scheduledCommits.length - sampleSize} more`));
        }

        // In dry-run mode, exit here
        if (options.dryRun) {
          console.log(chalk.yellow('\n⚠ DRY RUN: No commits were created.'));
          process.exit(0);
        }

        // Confirm before proceeding
        const { confirmCommits } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmCommits',
          message: `Create ${scheduledCommits.length} commits?`,
          default: false
        });

        if (!confirmCommits) {
          console.log(chalk.blue('Operation cancelled.'));
          process.exit(0);
        }

        // Process message template
        const messageTemplate = options.message || 'Commit generated by Graphify on {date}';

        // Prepare commit options
        const commitOptions = scheduledCommits.map(commit => ({
          date: commit.date.toJSDate(),
          message: messageTemplate.replace('{date}', formatDate(commit.date.toJSDate()))
                               .replace('{time}', commit.date.toFormat('HH:mm:ss'))
                               .replace('{weight}', commit.weight.toString()),
          createEmptyCommit: true
        }));

        // Execute commits
        await executeScheduledCommits(commitOptions);

        // Push if requested
        if (options.push) {
          try {
            await pushToGitHub();
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(chalk.red('Failed to push commits:'), errorMessage);
            console.log(chalk.yellow('You can push manually using: git push'));
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('Error:'), errorMessage);
        process.exit(1);
      }
    });
}

// Fix the undefined access in commit scheduling
async function scheduleCommits(
  pattern: number[][],
  startDate: string,
  endDate: string | null = null,
  options: any = {}
): Promise<void> {
  const {
    message = 'Update documentation',
    emptyCommits = true,
    commitMultiplier = 1
  } = options;

  try {
    // Validate dates
    const { start, end } = calculateDateRange(
      startDate,
      endDate,
      pattern.length * (pattern[0]?.length || 0) / 7
    );

    console.log(`Creating commits from ${start.toDateString()} to ${end.toDateString()}`);

    // Generate schedule based on the pattern
    const schedule = await generateCommitSchedule(pattern, start, end, {
      commitMultiplier,
      emptyCommits
    });

    // Show summary and confirm
    const totalCommits = schedule.length;
    console.log(`Total commits to be created: ${totalCommits}`);

    if (totalCommits === 0) {
      console.log(chalk.yellow('No commits to create. Try adjusting your pattern or date range.'));
      return;
    }

    const { confirm } = await inquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      message: `Create ${totalCommits} commits?`,
      default: false
    });

    if (!confirm) {
      console.log(chalk.yellow('Commit creation cancelled.'));
      return;
    }

    // Create the commits
    for (let i = 0; i < schedule.length; i++) {
      const commit = schedule[i];
      if (commit) { // Add null check here
        const { date, message: commitMessage, createEmptyCommit } = commit;
        await executeGitOperations(date, commitMessage, createEmptyCommit);
        process.stdout.write(`\rProcessing commits: ${i + 1}/${schedule.length} (${Math.round((i + 1) / schedule.length * 100)}%)`);
      }
    }

    console.log('\nCommits created successfully.');

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error scheduling commits:'), errorMessage);
  }
}

// Fix remaining null/undefined object checks in the file
async function printPatternPreview(pattern: number[][]): Promise<void> {
  console.log(chalk.blue('Pattern Preview:'));

  const rows = pattern.length;
  const cols = pattern[0]?.length || 0;

  // Print column headers (days of week)
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  console.log('    ' + days.join(' '));

  // Print rows with week numbers
  for (let i = 0; i < rows; i++) {
    const weekNum = `W${i + 1}`;
    let rowStr = `${weekNum.padEnd(3)} `;

    if (pattern[i]) { // Add null check
      for (let j = 0; j < cols; j++) {
        const value = pattern[i][j] || 0;
        switch (value) {
          case 0: rowStr += chalk.dim('·'); break;
          case 1: rowStr += chalk.green('▪'); break;
          case 2: rowStr += chalk.green('▪'); break;
          case 3: rowStr += chalk.green.bold('■'); break;
          case 4: rowStr += chalk.bgGreen('■'); break;
          default: rowStr += chalk.dim('·');
        }
        rowStr += ' ';
      }
    }

    console.log(rowStr);
  }

  // Legend
  console.log('\nLegend:');
  console.log(`${chalk.dim('·')} - No commits  ${chalk.green('▪')} - Light/Medium  ${chalk.green.bold('■')} - Heavy  ${chalk.bgGreen('■')} - Maximum`);
}

async function promptForPattern(): Promise<number[][]> {
  console.log(chalk.blue('Creating a simple pattern...'));
  console.log(chalk.dim('Use 0-4 for intensity levels (0 = no commits, 4 = maximum intensity)'));

  // Define interface for the prompt responses
  interface PatternPromptResponse {
    rows: number;
    columns: number;
  }

  const responses = await inquirer.prompt<PatternPromptResponse>([
    {
      type: 'number',
      name: 'rows',
      message: 'Number of rows:',
      default: 5,
      validate: (input: number | undefined) =>
        input !== undefined && input > 0 && input <= 10 ? true : 'Please enter a number between 1 and 10'
    },
    {
      type: 'number',
      name: 'columns',
      message: 'Number of columns:',
      default: 7,
      validate: (input: number | undefined) =>
        input !== undefined && input > 0 && input <= 20 ? true : 'Please enter a number between 1 and 20'
    }
  ]);

  const { rows, columns } = responses;

  // Create an empty pattern
  const pattern: number[][] = Array(rows).fill(0).map(() => Array(columns).fill(0));

  // For small patterns, prompt for each cell
  if (rows * columns <= 25) {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < columns; j++) {
        const { value } = await inquirer.prompt({
          type: 'list',
          name: 'value',
          message: `Intensity for cell [${i},${j}]:`,
          choices: [
            { name: '0 - No commits', value: 0 },
            { name: '1 - Light', value: 1 },
            { name: '2 - Medium', value: 2 },
            { name: '3 - Heavy', value: 3 },
            { name: '4 - Maximum', value: 4 }
          ]
        });

        // Add null check for the pattern array
        if (pattern[i]) {
          pattern[i][j] = value;
        }
      }
    }
  } else {
    // For larger patterns, use a simpler approach
    console.log(chalk.yellow('Pattern is too large for cell-by-cell input.'));

    const { fillType } = await inquirer.prompt({
      type: 'list',
      name: 'fillType',
      message: 'How would you like to fill the pattern?',
      choices: [
        { name: 'Uniform fill (all cells same value)', value: 'uniform' },
        { name: 'Random fill', value: 'random' }
      ]
    });

    if (fillType === 'uniform') {
      const { value } = await inquirer.prompt({
        type: 'list',
        name: 'value',
        message: 'Choose intensity level:',
        choices: [
          { name: '1 - Light', value: 1 },
          { name: '2 - Medium', value: 2 },
          { name: '3 - Heavy', value: 3 },
          { name: '4 - Maximum', value: 4 }
        ]
      });

      // Fill pattern with uniform value
      for (let i = 0; i < rows; i++) {
        if (pattern[i]) {
          for (let j = 0; j < columns; j++) {
            pattern[i][j] = value;
          }
        }
      }
    } else {
      // Fill with random values
      for (let i = 0; i < rows; i++) {
        if (pattern[i]) {
          for (let j = 0; j < columns; j++) {
            pattern[i][j] = Math.floor(Math.random() * 4) + 1; // Random 1-4
          }
        }
      }
    }
  }

  return pattern;
}

async function promptForDate(message: string, isStartDate: boolean): Promise<Date> {
  const defaultDate = new Date();
  if (isStartDate) {
    // Default to 1 month ago for start date
    defaultDate.setMonth(defaultDate.getMonth() - 1);
  }

  const defaultDateStr = defaultDate.toISOString().split('T')[0]; // YYYY-MM-DD

  const { dateStr } = await inquirer.prompt({
    type: 'input',
    name: 'dateStr',
    message,
    default: defaultDateStr,
    validate: (input: string) => {
      try {
        validateDateInput(input);
        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return errorMessage;
      }
    }
  });

  return validateDateInput(dateStr);
}

async function promptForDensity(): Promise<number> {
  interface DensityPromptResponse {
    density: number;
  }

  const response = await inquirer.prompt<DensityPromptResponse>({
    type: 'number',
    name: 'density',
    message: 'Enter commit density (0.1-1.0):',
    default: 0.7,
    validate: (input: number | undefined) => {
      if (input === undefined || isNaN(input) || input < 0.1 || input > 1.0) {
        return 'Please enter a number between 0.1 and 1.0';
      }
      return true;
    }
  });

  return response.density;
}

