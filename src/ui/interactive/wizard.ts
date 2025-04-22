import inquirer from 'inquirer';
import { DateTime } from 'luxon';
import path from 'path';
import fs from 'fs';
import ora from 'ora';
import { ThemeManager } from '../themes/theme';
import { UIComponents } from '../formatters/components';
import { UserPreferences } from '../../config/user-preferences';
import { CommitPatternType } from '../../config/default';

/**
 * Interactive wizard for guiding users through the configuration process
 */
export class InteractiveWizard {
  private ui: UIComponents;
  private theme: ThemeManager;
  private preferences: UserPreferences;

  constructor() {
    this.ui = new UIComponents();
    this.theme = ThemeManager.getInstance();
    this.preferences = UserPreferences.getInstance();
  }

  /**
   * Run the interactive wizard
   * @returns The user's configuration
   */
  async run(): Promise<any> {
    console.clear();
    console.log(this.ui.header());
    console.log(this.ui.info('Welcome to the Graphify interactive wizard! Let\'s configure your contribution pattern.'));
    console.log('');

    // Check if the user has recent projects
    const recentRepos = this.preferences.getRecentRepos();

    let repoPath = process.cwd();
    if (recentRepos.length > 0) {
      const { useRecent } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useRecent',
          message: 'Would you like to use a recently used repository?',
          default: true,
        }
      ]);

      if (useRecent) {
        const { selectedRepo } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedRepo',
            message: 'Select a repository:',
            choices: [
              ...recentRepos.map(repo => ({
                name: repo,
                value: repo
              })),
              { name: 'Use current directory', value: process.cwd() },
              { name: 'Specify a different path...', value: 'custom' }
            ]
          }
        ]);

        if (selectedRepo === 'custom') {
          const { customPath } = await inquirer.prompt([
            {
              type: 'input',
              name: 'customPath',
              message: 'Enter the repository path:',
              default: process.cwd(),
              validate: (input) => {
                const fullPath = path.resolve(input);
                if (!fs.existsSync(fullPath)) {
                  return 'Directory does not exist.';
                }
                if (!fs.existsSync(path.join(fullPath, '.git'))) {
                  return 'Not a git repository.';
                }
                return true;
              }
            }
          ]);

          repoPath = customPath;
        } else {
          repoPath = selectedRepo;
        }
      }
    } else {
      // No recent repos, ask for path
      const { customPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customPath',
          message: 'Enter the repository path:',
          default: process.cwd(),
          validate: (input) => {
            const fullPath = path.resolve(input);
            if (!fs.existsSync(fullPath)) {
              return 'Directory does not exist.';
            }
            if (!fs.existsSync(path.join(fullPath, '.git'))) {
              return 'Not a git repository.';
            }
            return true;
          }
        }
      ]);

      repoPath = customPath;
    }

    // Add to recent repos
    this.preferences.addRecentRepo(repoPath);

    // Get pattern preferences
    const { pattern } = await inquirer.prompt([
      {
        type: 'list',
        name: 'pattern',
        message: 'Choose a contribution pattern:',
        choices: [
          {
            name: 'Random - Randomly distributed across the date range',
            value: 'random'
          },
          {
            name: 'Gradient - More commits in recent dates',
            value: 'gradient'
          },
          {
            name: 'Snake - Zigzag pattern across the graph',
            value: 'snake'
          },
          {
            name: 'Heart - Heart-shaped pattern',
            value: 'heart'
          },
          {
            name: 'Realistic - Simulates typical developer activity',
            value: 'realistic'
          },
          {
            name: 'Steady - Consistent commit frequency',
            value: 'steady'
          },
          {
            name: 'Crescendo - Gradually increasing activity',
            value: 'crescendo'
          },
          {
            name: 'Custom - Use a saved custom pattern',
            value: 'custom',
            disabled: Object.keys(this.preferences.getPatterns()).length === 0
          }
        ],
        default: this.preferences.getDefaultPattern()
      }
    ]);

    let customPatternName = '';
    if (pattern === 'custom') {
      const savedPatterns = this.preferences.getPatterns();
      const { selectedPattern } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedPattern',
          message: 'Choose a saved pattern:',
          choices: Object.keys(savedPatterns).map(name => ({
            name,
            value: name
          }))
        }
      ]);

      customPatternName = selectedPattern;
    }

    // Get date range
    const oneYearAgo = DateTime.now().minus({ years: 1 }).toISODate();
    const today = DateTime.now().toISODate();

    const { dateRange } = await inquirer.prompt([
      {
        type: 'list',
        name: 'dateRange',
        message: 'Select a date range:',
        choices: [
          { name: 'Last year', value: 'last-year' },
          { name: 'Last 6 months', value: 'last-6-months' },
          { name: 'Last 3 months', value: 'last-3-months' },
          { name: 'Custom range...', value: 'custom' }
        ],
        default: 'last-year'
      }
    ]);

    let startDate = oneYearAgo;
    let endDate = today;

    if (dateRange === 'last-6-months') {
      startDate = DateTime.now().minus({ months: 6 }).toISODate();
    } else if (dateRange === 'last-3-months') {
      startDate = DateTime.now().minus({ months: 3 }).toISODate();
    } else if (dateRange === 'custom') {
      const customDates = await inquirer.prompt([
        {
          type: 'input',
          name: 'startDate',
          message: 'Enter start date (YYYY-MM-DD):',
          default: oneYearAgo,
          validate: (input) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
              return 'Invalid date format. Please use YYYY-MM-DD.';
            }
            return true;
          }
        },
        {
          type: 'input',
          name: 'endDate',
          message: 'Enter end date (YYYY-MM-DD):',
          default: today,
          validate: (input) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
              return 'Invalid date format. Please use YYYY-MM-DD.';
            }
            return true;
          }
        }
      ]);

      startDate = customDates.startDate;
      endDate = customDates.endDate;
    }

    // Get commit count
    const { commitCount } = await inquirer.prompt([
      {
        type: 'number',
        name: 'commitCount',
        message: 'How many commits would you like to generate?',
        default: 100,
        validate: (input) => {
          if (isNaN(input) || input < 1) {
            return 'Please enter a positive number.';
          }
          return true;
        }
      }
    ]);

    // Get advanced options
    const { showAdvanced } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'showAdvanced',
        message: 'Would you like to configure advanced options?',
        default: false
      }
    ]);

    let activeDays = [1, 2, 3, 4, 5]; // Monday to Friday
    let commitFrequency = 1;
    let timeOfDay = 'working-hours';
    let simulateVacations = false;
    let respectHolidays = false;
    let simulateDevelopmentCycles = false;

    if (showAdvanced) {
      const advancedOptions = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'activeDays',
          message: 'On which days of the week would you like to make commits?',
          choices: [
            { name: 'Sunday', value: 0, checked: false },
            { name: 'Monday', value: 1, checked: true },
            { name: 'Tuesday', value: 2, checked: true },
            { name: 'Wednesday', value: 3, checked: true },
            { name: 'Thursday', value: 4, checked: true },
            { name: 'Friday', value: 5, checked: true },
            { name: 'Saturday', value: 6, checked: false }
          ],
          validate: (input) => {
            if (input.length === 0) {
              return 'Please select at least one day.';
            }
            return true;
          }
        },
        {
          type: 'number',
          name: 'commitFrequency',
          message: 'How many commits per active day (on average)?',
          default: 1,
          validate: (input) => {
            if (isNaN(input) || input < 1) {
              return 'Please enter a positive number.';
            }
            return true;
          }
        },
        {
          type: 'list',
          name: 'timeOfDay',
          message: 'When should commits be made?',
          choices: [
            { name: 'Morning (8am-12pm)', value: 'morning' },
            { name: 'Afternoon (1pm-5pm)', value: 'afternoon' },
            { name: 'Evening (6pm-10pm)', value: 'evening' },
            { name: 'Night (10pm-8am)', value: 'night' },
            { name: 'Working Hours (9am-6pm)', value: 'working-hours' },
            { name: 'After Hours (6pm-8am)', value: 'after-hours' },
            { name: 'Random (any time)', value: 'random' }
          ],
          default: 'working-hours'
        },
        {
          type: 'confirm',
          name: 'simulateVacations',
          message: 'Would you like to simulate vacation periods (no commits)?',
          default: false
        },
        {
          type: 'confirm',
          name: 'respectHolidays',
          message: 'Would you like to respect common holidays (no commits)?',
          default: false
        },
        {
          type: 'confirm',
          name: 'simulateDevelopmentCycles',
          message: 'Would you like to simulate development cycles (sprints)?',
          default: false
        }
      ]);

      activeDays = advancedOptions.activeDays;
      commitFrequency = advancedOptions.commitFrequency;
      timeOfDay = advancedOptions.timeOfDay;
      simulateVacations = advancedOptions.simulateVacations;
      respectHolidays = advancedOptions.respectHolidays;
      simulateDevelopmentCycles = advancedOptions.simulateDevelopmentCycles;
    }

    // Safety check
    const { pushToRemote } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'pushToRemote',
        message: 'Would you like to push commits to the remote repository?',
        default: true
      }
    ]);

    // Save as default
    const { saveAsDefault } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveAsDefault',
        message: 'Would you like to save these settings as your default?',
        default: false
      }
    ]);

    if (saveAsDefault) {
      this.preferences.setDefaultPattern(pattern as CommitPatternType);
    }

    // Show summary
    console.log('');
    console.log(this.ui.sectionHeader('Configuration Summary'));
    console.log(this.ui.labeledValue('Repository', repoPath));
    console.log(this.ui.labeledValue('Pattern', pattern));
    console.log(this.ui.labeledValue('Date Range', `${startDate} to ${endDate}`));
    console.log(this.ui.labeledValue('Commit Count', commitCount));
    console.log(this.ui.labeledValue('Active Days', activeDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')));
    console.log(this.ui.labeledValue('Commit Frequency', `${commitFrequency} per active day`));
    console.log(this.ui.labeledValue('Time of Day', timeOfDay));
    console.log(this.ui.labeledValue('Simulate Vacations', simulateVacations ? 'Yes' : 'No'));
    console.log(this.ui.labeledValue('Respect Holidays', respectHolidays ? 'Yes' : 'No'));
    console.log(this.ui.labeledValue('Simulate Dev Cycles', simulateDevelopmentCycles ? 'Yes' : 'No'));
    console.log(this.ui.labeledValue('Push to Remote', pushToRemote ? 'Yes' : 'No'));

    // Final confirmation
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Do you want to proceed with this configuration?',
        default: true
      }
    ]);

    if (!confirm) {
      console.log(this.ui.info('Operation cancelled.'));
      return null;
    }

    // Return the configuration
    return {
      pattern: pattern === 'custom' ? this.preferences.getPattern(customPatternName) : pattern,
      repoPath,
      startDate,
      endDate,
      commitCount,
      activeDays,
      commitFrequency,
      timeOfDay,
      simulateVacations,
      respectHolidays,
      simulateDevelopmentCycles,
      pushToRemote
    };
  }
}
