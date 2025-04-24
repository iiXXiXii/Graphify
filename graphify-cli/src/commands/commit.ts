import { Command, Flags } from '@oclif/core';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as inquirer from 'inquirer';
import chalk from 'chalk';
import { validateDateInput, formatDate, createDateRange } from './date';
import { getAuthToken, isAuthenticated } from './auth';
import { executeGitOperations, executeScheduledCommits, pushToGitHub } from './git';
import {
  validatePattern,
  mapPatternToSchedule,
  checkScheduleAuthenticity,
  CommitScheduleOptions
} from '../utils/scheduler';

export default class Commit extends Command {
  static description = 'Generate backdated commits based on a pattern';

  static examples = [
    '$ graphify commit --pattern pattern.json --start-date 2023-01-01 --end-date 2023-12-31',
    '$ graphify commit --dry-run --density 0.5',
    '$ graphify commit --message "Working on feature X" --push'
  ];

  static flags = {
    pattern: Flags.string({
      char: 'p',
      description: 'Path to pattern file (JSON)',
      required: false,
    }),
    'start-date': Flags.string({
      char: 's',
      description: 'Start date for the commit pattern (YYYY-MM-DD)',
      required: false,
    }),
    'end-date': Flags.string({
      char: 'e',
      description: 'End date for the commit pattern (YYYY-MM-DD)',
      required: false,
    }),
    density: Flags.string({
      char: 'd',
      description: 'Commit density factor (0.0-1.0)',
      required: false,
    }),
    message: Flags.string({
      char: 'm',
      description: 'Custom commit message template',
      required: false,
    }),
    'dry-run': Flags.boolean({
      description: 'Preview commits without actually creating them',
      required: false,
      default: false,
    }),
    'work-hours-only': Flags.boolean({
      description: 'Only create commits during typical work hours (9-5)',
      required: false,
      default: false,
    }),
    'avoid-weekends': Flags.boolean({
      description: 'Reduce commit frequency on weekends',
      required: false,
      default: true,
    }),
    randomize: Flags.boolean({
      description: 'Add randomness to commit times for more natural patterns',
      required: false,
      default: true,
    }),
    push: Flags.boolean({
      description: 'Push commits to remote after creation',
      required: false,
      default: false,
    })
  };

  async run() {
    try {
      const { flags } = await this.parse(Commit);

      // Check authentication
      if (!isAuthenticated()) {
        console.log(chalk.yellow('⚠ Not authenticated with GitHub.'));
        const { shouldAuth } = await inquirer.prompt({
          type: 'confirm',
          name: 'shouldAuth',
          message: 'Would you like to authenticate now?',
          default: true
        });

        if (shouldAuth) {
          // Import dynamically to avoid circular dependency
          const { authenticateWithGitHub } = require('./auth');
          await authenticateWithGitHub();
        } else {
          console.log(chalk.yellow('⚠ Continuing without authentication. Some features may be limited.'));
        }
      }

      // Get or prompt for pattern
      let pattern: number[][] = [];
      if (flags.pattern) {
        try {
          const patternData = await fs.readFile(flags.pattern, 'utf-8');
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
        } catch (error) {
          console.error(chalk.red('Failed to load pattern file:'), error.message);

          const { createNew } = await inquirer.prompt({
            type: 'confirm',
            name: 'createNew',
            message: 'Would you like to create a simple pattern instead?',
            default: true
          });

          if (createNew) {
            pattern = await this.promptForPattern();
          } else {
            this.exit(1);
          }
        }
      } else {
        // Create a simple default pattern
        pattern = await this.promptForPattern();
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
          this.exit(1);
        }
      }

      // Get or prompt for start date
      const startDate = flags['start-date']
        ? validateDateInput(flags['start-date'])
        : await this.promptForDate('Enter start date (YYYY-MM-DD):', true);

      // Get or prompt for end date
      const endDate = flags['end-date']
        ? validateDateInput(flags['end-date'])
        : await this.promptForDate('Enter end date (YYYY-MM-DD):', false);

      // Get or prompt for density
      const density = flags.density
        ? parseFloat(flags.density)
        : await this.promptForDensity();

      // Create commit schedule options
      const scheduleOptions: CommitScheduleOptions = {
        pattern,
        startDate,
        endDate,
        density,
        randomize: flags.randomize,
        workHoursOnly: flags['work-hours-only'],
        avoidWeekends: flags['avoid-weekends']
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
          this.exit(0);
        }
      }

      // Display preview
      console.log(chalk.blue('\n📅 Commit Schedule Preview:'));
      console.log(`Total commits: ${chalk.bold(scheduledCommits.length)}`);
      console.log(`Date range: ${chalk.bold(formatDate(startDate))} to ${chalk.bold(formatDate(endDate))}`);
      console.log(`Density factor: ${chalk.bold(density)}`);

      // Show sample of commits
      const sampleSize = Math.min(5, scheduledCommits.length);
      console.log(chalk.dim('\nSample of scheduled commits:'));
      for (let i = 0; i < sampleSize; i++) {
        const commit = scheduledCommits[i];
        console.log(chalk.dim(`  - ${formatDate(commit.date)} at ${commit.date.toLocaleTimeString()}: Intensity ${commit.weight}`));
      }

      if (scheduledCommits.length > sampleSize) {
        console.log(chalk.dim(`  ... and ${scheduledCommits.length - sampleSize} more`));
      }

      // In dry-run mode, exit here
      if (flags['dry-run']) {
        console.log(chalk.yellow('\n⚠ DRY RUN: No commits were created.'));
        this.exit(0);
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
        this.exit(0);
      }

      // Process message template
      const messageTemplate = flags.message || 'Commit generated by Graphify on {date}';

      // Prepare commit options
      const commitOptions = scheduledCommits.map(commit => ({
        date: commit.date,
        message: messageTemplate.replace('{date}', formatDate(commit.date))
                               .replace('{time}', commit.date.toLocaleTimeString())
                               .replace('{weight}', commit.weight.toString()),
        createEmptyCommit: true
      }));

      // Execute commits
      await executeScheduledCommits(commitOptions);

      // Push if requested
      if (flags.push) {
        try {
          await pushToGitHub();
        } catch (error) {
          console.error(chalk.red('Failed to push commits:'), error.message);
          console.log(chalk.yellow('You can push manually using: git push'));
        }
      }

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      this.exit(1);
    }
  }

  async promptForPattern(): Promise<number[][]> {
    const { patternType } = await inquirer.prompt({
      type: 'list',
      name: 'patternType',
      message: 'Choose a pattern type:',
      choices: [
        { name: 'Simple (one intensity level)', value: 'simple' },
        { name: 'Custom grid (multiple intensity levels)', value: 'custom' }
      ]
    });

    if (patternType === 'simple') {
      const { rows, columns } = await inquirer.prompt([
        {
          type: 'number',
          name: 'rows',
          message: 'Number of rows:',
          default: 5
        },
        {
          type: 'number',
          name: 'columns',
          message: 'Number of columns:',
          default: 7
        }
      ]);

      // Create a default pattern (all cells intensity 1)
      return Array(rows).fill(0).map(() => Array(columns).fill(1));
    } else {
      console.log(chalk.blue('Creating a custom grid pattern:'));
      console.log(chalk.dim('Use 0-4 for intensity levels (0 = no commits, 4 = maximum intensity)'));

      const { rows, columns } = await inquirer.prompt([
        {
          type: 'number',
          name: 'rows',
          message: 'Number of rows:',
          default: 5,
          validate: (input: number) => input > 0 && input <= 10 ? true : 'Please enter a number between 1 and 10'
        },
        {
          type: 'number',
          name: 'columns',
          message: 'Number of columns:',
          default: 7,
          validate: (input: number) => input > 0 && input <= 20 ? true : 'Please enter a number between 1 and 20'
        }
      ]);

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
            pattern[i][j] = value;
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
            for (let j = 0; j < columns; j++) {
              pattern[i][j] = value;
            }
          }
        } else {
          // Fill with random values
          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
              pattern[i][j] = Math.floor(Math.random() * 4) + 1; // Random 1-4
            }
          }
        }
      }

      return pattern;
    }
  }

  async promptForDate(message: string, isStartDate: boolean): Promise<Date> {
    const defaultDate = new Date();
    if (isStartDate) {
      // Default to 1 month ago for start date
      defaultDate.setMonth(defaultDate.getMonth() - 1);
    }

    const defaultDateStr = formatDate(defaultDate);

    const { dateStr } = await inquirer.prompt({
      type: 'input',
      name: 'dateStr',
      message,
      default: defaultDateStr,
      validate: (input: string) => {
        try {
          validateDateInput(input);
          return true;
        } catch (error) {
          return error.message;
        }
      }
    });

    return validateDateInput(dateStr);
  }

  async promptForDensity(): Promise<number> {
    const { density } = await inquirer.prompt({
      type: 'list',
      name: 'density',
      message: 'Select commit density:',
      choices: [
        { name: 'Light (fewer commits)', value: 0.3 },
        { name: 'Medium', value: 0.5 },
        { name: 'Heavy', value: 0.7 },
        { name: 'Maximum (many commits)', value: 1.0 },
        { name: 'Custom...', value: 'custom' }
      ]
    });

    if (density === 'custom') {
      const { customDensity } = await inquirer.prompt({
        type: 'number',
        name: 'customDensity',
        message: 'Enter density factor (0.0-1.0):',
        default: 0.5,
        validate: (input: number) => {
          if (isNaN(input) || input < 0 || input > 1) {
            return 'Please enter a number between 0 and 1';
          }
          return true;
        }
      });

      return customDensity;
    }

    return density;
  }
}
