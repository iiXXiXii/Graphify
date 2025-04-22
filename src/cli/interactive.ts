import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { GraphifyConfig } from '../models/config';
import { Graphify } from '../core/graphify';
import { ErrorHandler, ErrorLevel } from '../utils/errorHandler';
import { GitHubService } from '../services/githubService';
import { join } from 'path';
import { existsSync } from 'fs';
import terminalLink from 'terminal-link';
import { DateTime } from 'luxon';

/**
 * Interactive CLI for Graphify
 */
export class GraphifyInteractive {
  private gitHubService: GitHubService;

  constructor() {
    this.gitHubService = new GitHubService();
  }

  /**
   * Run the interactive CLI
   */
  static async run(): Promise<void> {
    const cli = new GraphifyInteractive();
    await cli.showMainMenu();
  }

  /**
   * Show the main menu
   */
  private async showMainMenu(): Promise<void> {
    console.log(
      chalk.bold.green('\n🎨 Graphify - GitHub Contribution Pattern Generator\n')
    );

    // Check GitHub authentication status
    const isAuthenticated = await this.gitHubService.isAuthenticated();
    let userInfo = null;
    
    if (isAuthenticated) {
      userInfo = await this.gitHubService.getUserInfo();
      if (userInfo) {
        console.log(
          chalk.cyan(`Logged in as ${chalk.bold(userInfo.name || userInfo.login)}\n`)
        );
      }
    }

    try {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '🎨 Create contribution pattern', value: 'create' },
            { name: '🔍 Validate repository', value: 'validate' },
            { name: '⚙️ Manage configurations', value: 'configs' },
            { name: '🌐 GitHub integration', value: 'github' },
            { name: '📖 Show documentation', value: 'docs' },
            { name: '👋 Exit', value: 'exit' }
          ],
        },
      ]);

      switch (action) {
        case 'create':
          await this.runCreatePattern();
          break;
        case 'validate':
          await this.validateRepository();
          break;
        case 'configs':
          await this.manageConfigurations();
          break;
        case 'github':
          await this.manageGitHubIntegration();
          break;
        case 'docs':
          await this.showDocumentation();
          break;
        case 'exit':
          console.log(chalk.yellow('\nThanks for using Graphify! 👋'));
          process.exit(0);
      }

      // Return to main menu after action completes
      await this.showMainMenu();
    } catch (error) {
      ErrorHandler.handle(
        error instanceof Error ? error : String(error),
        'Main Menu',
        ErrorLevel.ERROR
      );
      process.exit(1);
    }
  }

  /**
   * Run the create pattern wizard
   */
  private async runCreatePattern(): Promise<void> {
    console.log(
      chalk.bold.green('\n🎨 Create Contribution Pattern\n')
    );

    try {
      // 1. Get repository path
      const { repoPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'repoPath',
          message: 'Enter the path to your Git repository:',
          validate: (input: string) => {
            if (!input) return 'Repository path is required';
            
            if (!existsSync(join(input, '.git'))) {
              return 'Invalid Git repository. Please make sure the path contains a .git directory.';
            }
            
            return true;
          }
        }
      ]);

      // 2. Basic options
      const { numCommits, pattern, activeDays } = await inquirer.prompt([
        {
          type: 'number',
          name: 'numCommits',
          message: 'Number of commits to generate:',
          default: 1000,
          validate: (input: number) => {
            if (isNaN(input) || input <= 0) {
              return 'Please enter a positive number';
            }
            return true;
          }
        },
        {
          type: 'list',
          name: 'pattern',
          message: 'Select a contribution pattern:',
          choices: [
            { name: 'Random', value: 'random' },
            { name: 'Wave', value: 'wave' },
            { name: 'Heart', value: 'heart' },
            { name: 'Custom text', value: 'text' }
          ]
        },
        {
          type: 'checkbox',
          name: 'activeDays',
          message: 'Select active days of the week:',
          choices: [
            { name: 'Monday', value: 1, checked: true },
            { name: 'Tuesday', value: 2, checked: true },
            { name: 'Wednesday', value: 3, checked: true },
            { name: 'Thursday', value: 4, checked: true },
            { name: 'Friday', value: 5, checked: true },
            { name: 'Saturday', value: 6, checked: false },
            { name: 'Sunday', value: 0, checked: false }
          ]
        }
      ]);

      // 3. Pattern-specific options
      let customText = '';
      if (pattern === 'text') {
        const { text } = await inquirer.prompt([
          {
            type: 'input',
            name: 'text',
            message: 'Enter custom text for the pattern:',
            validate: (input: string) => {
              if (!input) return 'Text is required';
              if (input.length > 10) return 'Text must be 10 characters or less';
              return true;
            }
          }
        ]);
        customText = text;
      }

      // 4. Advanced options
      const { showAdvanced } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'showAdvanced',
          message: 'Configure advanced options?',
          default: false
        }
      ]);

      let vacationDays: string[] = [];
      let intensityFactor = 1;
      let useRealisticTimestamps = true;

      if (showAdvanced) {
        const advancedAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'vacationDays',
            message: 'Enter vacation days (YYYY-MM-DD, comma separated):',
            filter: (input: string) => 
              input ? input.split(',').map(d => d.trim()) : []
          },
          {
            type: 'number',
            name: 'intensityFactor',
            message: 'Intensity factor (0.1 - 5):',
            default: 1,
            validate: (input: number) => {
              if (isNaN(input) || input < 0.1 || input > 5) {
                return 'Please enter a number between 0.1 and 5';
              }
              return true;
            }
          },
          {
            type: 'confirm',
            name: 'useRealisticTimestamps',
            message: 'Use realistic timestamps?',
            default: true
          }
        ]);

        vacationDays = advancedAnswers.vacationDays;
        intensityFactor = advancedAnswers.intensityFactor;
        useRealisticTimestamps = advancedAnswers.useRealisticTimestamps;
      }

      // 5. Save configuration option
      const { saveConfig, configName } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'saveConfig',
          message: 'Save this configuration for future use?',
          default: false
        },
        {
          type: 'input',
          name: 'configName',
          message: 'Configuration name:',
          when: (answers) => answers.saveConfig,
          validate: (input: string) => {
            if (!input) return 'Name is required';
            return true;
          }
        }
      ]);

      // Build configuration object
      const config: GraphifyConfig = {
        repoPath,
        numCommits,
        pattern: pattern === 'text' ? { type: 'text', text: customText } : { type: pattern },
        activeDays,
        vacationDays,
        intensityFactor,
        useRealisticTimestamps
      };

      // Save configuration if requested
      if (saveConfig && configName) {
        try {
          await Graphify.saveConfig(configName, config);
          console.log(chalk.green(`Configuration '${configName}' saved successfully!`));
        } catch (error) {
          ErrorHandler.handle(
            error instanceof Error ? error : String(error),
            'Save Configuration',
            ErrorLevel.ERROR
          );
        }
      }

      // Run Graphify with the configuration
      console.log(chalk.cyan('\nStarting pattern generation...'));
      const spinner = ora('Processing...').start();

      try {
        const graphify = new Graphify(config);
        await graphify.run();
        spinner.succeed('Pattern generated successfully!');
      } catch (error) {
        spinner.fail('Pattern generation failed.');
        ErrorHandler.handle(
          error instanceof Error ? error : String(error),
          'Pattern Generation',
          ErrorLevel.ERROR
        );
      }
    } catch (error) {
      ErrorHandler.handle(
        error instanceof Error ? error : String(error),
        'Create Pattern',
        ErrorLevel.ERROR
      );
    }
  }

  /**
   * Validate repository option
   */
  private async validateRepository(): Promise<void> {
    console.log(
      chalk.bold.green('\n🔍 Validate Repository\n')
    );

    try {
      // Get repository path
      const { repoPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'repoPath',
          message: 'Enter the path to your Git repository:',
          validate: (input: string) => {
            if (!input) return 'Repository path is required';
            
            if (!existsSync(join(input, '.git'))) {
              return 'Invalid Git repository. Please make sure the path contains a .git directory.';
            }
            
            return true;
          }
        }
      ]);

      // Validate the repository
      console.log(chalk.cyan('\nValidating repository...'));
      const spinner = ora('Processing...').start();

      try {
        const graphify = new Graphify({ repoPath });
        const result = await graphify.validateRepository();
        spinner.succeed('Validation completed!');

        // Display validation results
        console.log(chalk.bold('\nValidation Results:'));
        
        const table = new Table({
          head: [
            chalk.cyan('Metric'),
            chalk.cyan('Value')
          ]
        });

        table.push(
          ['Total Commits', result.totalCommits.toString()],
          ['Date Range', `${result.startDate} to ${result.endDate}`],
          ['Active Days', result.activeDays.toString()],
          ['Commit Pattern', result.hasPattern ? 'Detected' : 'Not detected'],
          ['Average Daily Commits', result.averageDailyCommits.toFixed(2)]
        );

        console.log(table.toString());

        // Additional insights
        console.log(chalk.bold('\nInsights:'));
        result.insights.forEach(insight => {
          console.log(`- ${insight}`);
        });
      } catch (error) {
        spinner.fail('Validation failed.');
        ErrorHandler.handle(
          error instanceof Error ? error : String(error),
          'Repository Validation',
          ErrorLevel.ERROR
        );
      }
    } catch (error) {
      ErrorHandler.handle(
        error instanceof Error ? error : String(error),
        'Validate Repository',
        ErrorLevel.ERROR
      );
    }
  }

  /**
   * Manage saved configurations
   */
  private async manageConfigurations(): Promise<void> {
    console.log(
      chalk.bold.green('\n⚙️ Manage Configurations\n')
    );

    try {
      // Get saved configurations
      const configs = await Graphify.listConfigs();

      if (configs.length === 0) {
        console.log(chalk.yellow('No saved configurations found.'));
        return;
      }

      // Show available configurations
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Load a configuration', value: 'load' },
            { name: 'Delete a configuration', value: 'delete' },
            { name: 'Show all configurations', value: 'show' },
            { name: 'Back to main menu', value: 'back' }
          ]
        }
      ]);

      if (action === 'back') {
        return;
      }

      if (action === 'show') {
        // Display all configurations
        console.log(chalk.bold('\nSaved Configurations:'));
        
        configs.forEach((config, index) => {
          console.log(chalk.cyan(`\n${index + 1}. ${config.name}`));
          
          const table = new Table({
            head: [
              chalk.cyan('Setting'),
              chalk.cyan('Value')
            ]
          });

          table.push(
            ['Repository Path', config.config.repoPath],
            ['Number of Commits', config.config.numCommits.toString()],
            ['Pattern Type', config.config.pattern.type],
            ['Active Days', config.config.activeDays.join(', ')],
            ['Intensity Factor', config.config.intensityFactor.toString()],
            ['Realistic Timestamps', config.config.useRealisticTimestamps ? 'Yes' : 'No']
          );

          console.log(table.toString());
        });
        
        return;
      }

      // Select a configuration
      const { configIndex } = await inquirer.prompt([
        {
          type: 'list',
          name: 'configIndex',
          message: `Select a configuration to ${action}:`,
          choices: configs.map((config, index) => ({
            name: config.name,
            value: index
          }))
        }
      ]);

      const selectedConfig = configs[configIndex];

      if (action === 'load') {
        // Load and use the selected configuration
        const { useConfig } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useConfig',
            message: `Use configuration '${selectedConfig.name}'?`,
            default: true
          }
        ]);

        if (useConfig) {
          console.log(chalk.cyan('\nStarting pattern generation...'));
          const spinner = ora('Processing...').start();

          try {
            const graphify = new Graphify(selectedConfig.config);
            await graphify.run();
            spinner.succeed('Pattern generated successfully!');
          } catch (error) {
            spinner.fail('Pattern generation failed.');
            ErrorHandler.handle(
              error instanceof Error ? error : String(error),
              'Pattern Generation',
              ErrorLevel.ERROR
            );
          }
        }
      } else if (action === 'delete') {
        // Delete the selected configuration
        const { confirmDelete } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmDelete',
            message: `Are you sure you want to delete configuration '${selectedConfig.name}'?`,
            default: false
          }
        ]);

        if (confirmDelete) {
          try {
            await Graphify.deleteConfig(selectedConfig.name);
            console.log(chalk.green(`Configuration '${selectedConfig.name}' deleted successfully!`));
          } catch (error) {
            ErrorHandler.handle(
              error instanceof Error ? error : String(error),
              'Delete Configuration',
              ErrorLevel.ERROR
            );
          }
        }
      }
    } catch (error) {
      ErrorHandler.handle(
        error instanceof Error ? error : String(error),
        'Manage Configurations',
        ErrorLevel.ERROR
      );
    }
  }

  /**
   * Manage GitHub integration
   */
  private async manageGitHubIntegration(): Promise<void> {
    console.log(
      chalk.bold.green('\n🌐 GitHub Integration\n')
    );

    try {
      // Check if already authenticated
      const isAuthenticated = await this.gitHubService.isAuthenticated();
      let userInfo = null;
      
      if (isAuthenticated) {
        userInfo = await this.gitHubService.getUserInfo();
      }

      if (isAuthenticated && userInfo) {
        console.log(
          chalk.cyan(`Logged in as ${chalk.bold(userInfo.name || userInfo.login)}\n`)
        );
        
        // Show user stats
        const stats = await this.gitHubService.getContributionStats();
        
        if (stats) {
          const table = new Table({
            head: [
              chalk.cyan('GitHub Stats'),
              chalk.cyan('Value')
            ]
          });

          table.push(
            ['Total Contributions', stats.totalContributions.toString()],
            ['Current Streak', stats.streakData.currentStreak.toString()],
            ['Longest Streak', stats.streakData.longestStreak.toString()],
            ['Public Repos', userInfo.publicRepos.toString()],
            ['Followers', userInfo.followers.toString()]
          );

          console.log(table.toString());
        }

        // Show options for authenticated user
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'GitHub options:',
            choices: [
              { name: '📊 View repositories', value: 'repos' },
              { name: '📈 Analyze contribution patterns', value: 'analyze' },
              { name: '🔄 Sync repository with GitHub', value: 'sync' },
              { name: '👤 View profile', value: 'profile' },
              { name: '🚪 Logout', value: 'logout' },
              { name: '🔙 Back to main menu', value: 'back' }
            ]
          }
        ]);

        switch (action) {
          case 'repos':
            await this.listGitHubRepositories();
            break;
          case 'analyze':
            await this.analyzeContributionPatterns();
            break;
          case 'sync':
            await this.syncRepositoryWithGitHub();
            break;
          case 'profile':
            await this.viewGitHubProfile();
            break;
          case 'logout':
            await this.gitHubService.logout();
            console.log(chalk.yellow('Logged out successfully.'));
            break;
          case 'back':
            return;
        }
      } else {
        // Not authenticated, show login option
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'GitHub options:',
            choices: [
              { name: '🔑 Login with GitHub token', value: 'login' },
              { name: '🔙 Back to main menu', value: 'back' }
            ]
          }
        ]);

        if (action === 'back') {
          return;
        }

        if (action === 'login') {
          const { token } = await inquirer.prompt([
            {
              type: 'password',
              name: 'token',
              message: 'Enter your GitHub personal access token:',
              validate: (input: string) => {
                if (!input) return 'Token is required';
                return true;
              }
            }
          ]);

          const spinner = ora('Authenticating...').start();
          const success = await this.gitHubService.authenticate(token);

          if (success) {
            spinner.succeed('Successfully authenticated with GitHub!');
            // Recall this method to show the authenticated options
            await this.manageGitHubIntegration();
          } else {
            spinner.fail('Authentication failed. Please check your token and try again.');
          }
        }
      }
    } catch (error) {
      ErrorHandler.handle(
        error instanceof Error ? error : String(error),
        'GitHub Integration',
        ErrorLevel.ERROR
      );
    }
  }

  /**
   * List GitHub repositories
   */
  private async listGitHubRepositories(): Promise<void> {
    const spinner = ora('Loading repositories...').start();
    
    try {
      const repos = await this.gitHubService.getUserRepositories();
      spinner.succeed(`Found ${repos.length} repositories`);
      
      if (repos.length === 0) {
        console.log(chalk.yellow('No repositories found.'));
        return;
      }
      
      // Display repositories in pages
      const PAGE_SIZE = 10;
      let currentPage = 0;
      const totalPages = Math.ceil(repos.length / PAGE_SIZE);
      
      while (true) {
        const startIdx = currentPage * PAGE_SIZE;
        const endIdx = Math.min(startIdx + PAGE_SIZE, repos.length);
        const pageRepos = repos.slice(startIdx, endIdx);
        
        console.log(chalk.bold(`\nRepositories (page ${currentPage + 1}/${totalPages}):`));
        
        pageRepos.forEach((repo, idx) => {
          const index = startIdx + idx + 1;
          console.log(
            chalk.cyan(`${index}. ${repo.name}`) + 
            (repo.private ? chalk.red(' (Private)') : '') +
            `\n   ${chalk.dim(repo.description || 'No description')}` +
            `\n   ${chalk.blue(repo.url)}` +
            `\n   ${chalk.yellow(`Language: ${repo.language || 'Unknown'}`)}` +
            `\n   ${chalk.dim(`Updated: ${new Date(repo.updatedAt).toLocaleDateString()}`)}`
          );
        });
        
        if (totalPages <= 1) {
          break;
        }
        
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'Navigation:',
            choices: [
              ...(currentPage > 0 ? [{ name: '⬅️ Previous page', value: 'prev' }] : []),
              ...(currentPage < totalPages - 1 ? [{ name: '➡️ Next page', value: 'next' }] : []),
              { name: '🔍 Select repository', value: 'select' },
              { name: '🔙 Back', value: 'back' }
            ]
          }
        ]);
        
        if (action === 'prev') {
          currentPage--;
        } else if (action === 'next') {
          currentPage++;
        } else if (action === 'select') {
          // Allow selecting a repository
          const { repoIndex } = await inquirer.prompt([
            {
              type: 'number',
              name: 'repoIndex',
              message: 'Enter repository number:',
              validate: (input: number) => {
                if (isNaN(input) || input < 1 || input > repos.length) {
                  return `Please enter a number between 1 and ${repos.length}`;
                }
                return true;
              }
            }
          ]);
          
          const selectedRepo = repos[repoIndex - 1];
          
          const { action } = await inquirer.prompt([
            {
              type: 'list',
              name: 'action',
              message: `Selected ${selectedRepo.name}. What would you like to do?`,
              choices: [
                { name: '📊 Analyze contribution pattern', value: 'analyze' },
                { name: '📥 Clone repository', value: 'clone' },
                { name: '🔙 Back to repository list', value: 'back' }
              ]
            }
          ]);
          
          if (action === 'analyze') {
            // TO-DO: Implement repository analysis
            console.log(chalk.yellow('Repository analysis is not yet implemented.'));
          } else if (action === 'clone') {
            // TO-DO: Implement repository cloning
            console.log(chalk.yellow('Repository cloning is not yet implemented.'));
          }
        } else if (action === 'back') {
          break;
        }
      }
    } catch (error) {
      spinner.fail('Failed to load repositories');
      ErrorHandler.handle(
        error instanceof Error ? error : String(error),
        'List Repositories',
        ErrorLevel.ERROR
      );
    }
  }

  /**
   * Analyze contribution patterns
   */
  private async analyzeContributionPatterns(): Promise<void> {
    // This is a placeholder for future implementation
    console.log(chalk.yellow('Contribution pattern analysis is not yet implemented.'));
  }

  /**
   * Sync repository with GitHub
   */
  private async syncRepositoryWithGitHub(): Promise<void> {
    // This is a placeholder for future implementation
    console.log(chalk.yellow('Repository sync is not yet implemented.'));
  }

  /**
   * View GitHub profile
   */
  private async viewGitHubProfile(): Promise<void> {
    const spinner = ora('Loading profile...').start();
    
    try {
      const userInfo = await this.gitHubService.getUserInfo();
      spinner.succeed('Profile loaded');
      
      if (userInfo) {
        console.log(chalk.bold('\nGitHub Profile:'));
        
        const table = new Table({
          head: [
            chalk.cyan('Profile Information'),
            chalk.cyan('Value')
          ]
        });

        table.push(
          ['Username', userInfo.login],
          ['Name', userInfo.name || 'Not set'],
          ['Public Repositories', userInfo.publicRepos.toString()],
          ['Followers', userInfo.followers.toString()],
          ['Following', userInfo.following.toString()]
        );

        console.log(table.toString());
        
        // Show contribution stats
        const stats = await this.gitHubService.getContributionStats();
        
        if (stats) {
          console.log(chalk.bold('\nContribution Statistics:'));
          
          const statsTable = new Table({
            head: [
              chalk.cyan('Statistic'),
              chalk.cyan('Value')
            ]
          });

          statsTable.push(
            ['Total Contributions (Past Year)', stats.totalContributions.toString()],
            ['Current Streak', stats.streakData.currentStreak.toString()],
            ['Longest Streak', stats.streakData.longestStreak.toString()]
          );

          console.log(statsTable.toString());
          
          // Display weekly contributions in a basic chart
          console.log(chalk.bold('\nWeekly Contributions (Last 10 Weeks):'));
          
          const recentWeeks = stats.weeklyContributions.slice(-10);
          const maxContributions = Math.max(...recentWeeks.map(w => w.count));
          
          recentWeeks.forEach(week => {
            const date = new Date(week.week);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            const barLength = Math.ceil((week.count / maxContributions) * 20);
            const bar = '█'.repeat(barLength);
            
            console.log(
              `${chalk.dim(dateStr)} ${chalk.green(bar)} ${week.count}`
            );
          });
        }
      }
    } catch (error) {
      spinner.fail('Failed to load profile');
      ErrorHandler.handle(
        error instanceof Error ? error : String(error),
        'View Profile',
        ErrorLevel.ERROR
      );
    }
  }

  /**
   * Show documentation
   */
  private async showDocumentation(): Promise<void> {
    console.log(
      chalk.bold.green('\n📖 Graphify Documentation\n')
    );

    // Documentation sections
    const sections = [
      {
        title: 'Getting Started',
        content: `
Graphify is a tool for creating custom GitHub contribution patterns.
It allows you to generate commit patterns that appear in your GitHub contribution graph.

Basic usage:
1. Create a new repository or use an existing one
2. Use Graphify to generate a pattern of commits
3. Push the repository to GitHub
4. View your GitHub profile to see the pattern
`
      },
      {
        title: 'Pattern Types',
        content: `
Graphify supports several types of patterns:

- Random: Creates a random distribution of commits
- Wave: Creates a wave pattern across your contribution graph
- Heart: Creates a heart shape in your contribution graph
- Text: Creates custom text in your contribution graph (limited to 10 characters)
`
      },
      {
        title: 'Advanced Features',
        content: `
Graphify includes several advanced features:

- Active Days: Control which days of the week will have commits
- Vacation Days: Specify dates that should have no commits
- Intensity Factor: Control the intensity of the commit pattern
- Realistic Timestamps: Generate commits with realistic timestamp patterns
- Configuration Management: Save and reuse your favorite patterns
`
      },
      {
        title: 'GitHub Integration',
        content: `
With GitHub integration, you can:

- View your GitHub profile and statistics
- Analyze your current contribution patterns
- Sync repositories directly with GitHub
- View and manage your GitHub repositories

Note: GitHub integration requires authentication with a personal access token.
`
      }
    ];

    try {
      // Show documentation menu
      const { section } = await inquirer.prompt([
        {
          type: 'list',
          name: 'section',
          message: 'Select a documentation section:',
          choices: [
            ...sections.map(section => ({ name: section.title, value: section.title })),
            { name: 'Back to main menu', value: 'back' }
          ]
        }
      ]);

      if (section === 'back') {
        return;
      }

      // Display the selected section
      const selectedSection = sections.find(s => s.title === section);
      
      if (selectedSection) {
        console.log(chalk.bold.cyan(`\n${selectedSection.title}\n`));
        console.log(selectedSection.content);
      }

      // Wait for user to continue
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...'
        }
      ]);
    } catch (error) {
      ErrorHandler.handle(
        error instanceof Error ? error : String(error),
        'Documentation',
        ErrorLevel.ERROR
      );
    }
  }
}

/**
 * Launch the interactive CLI mode
 * @param defaultConfig Default configuration to use
 */
export async function launchInteractiveMode(defaultConfig: Partial<GraphifyConfig> = {}): Promise<void> {
  console.log(chalk.blue('🧙 Welcome to Graphify Interactive Mode 🧙'));
  console.log(chalk.gray('Let\'s customize your GitHub contribution graph\n'));

  // Get available patterns
  const availablePatterns = getCommitPatterns();
  
  // Initial setup questions
  const setupAnswers = await inquirer.prompt([
    {
      type: 'list',
      name: 'patternType',
      message: 'Select a commit pattern:',
      choices: availablePatterns.map(p => ({
        name: `${p.name}: ${p.description}`,
        value: p.id
      })),
      default: defaultConfig.pattern || 'random',
    },
    {
      type: 'number',
      name: 'commitCount',
      message: 'How many commits would you like to generate?',
      default: defaultConfig.commitCount || 100,
      validate: (value) => value > 0 ? true : 'Please enter a positive number',
    },
    {
      type: 'checkbox',
      name: 'activeDays',
      message: 'Which days of the week should have commits?',
      choices: [
        { name: 'Sunday', value: 0 },
        { name: 'Monday', value: 1 },
        { name: 'Tuesday', value: 2 },
        { name: 'Wednesday', value: 3 },
        { name: 'Thursday', value: 4 },
        { name: 'Friday', value: 5 },
        { name: 'Saturday', value: 6 }
      ],
      default: defaultConfig.activeDays || [1, 2, 3, 4, 5],
    },
    {
      type: 'list',
      name: 'timeOfDay',
      message: 'When during the day should commits appear?',
      choices: [
        { name: 'Working Hours (9am-6pm)', value: 'working-hours' },
        { name: 'Morning (8am-12pm)', value: 'morning' },
        { name: 'Afternoon (1pm-5pm)', value: 'afternoon' },
        { name: 'Evening (6pm-10pm)', value: 'evening' },
        { name: 'Night (10pm-2am)', value: 'night' },
        { name: 'Random Times', value: 'random' },
      ],
      default: defaultConfig.timeOfDay || 'working-hours',
    },
  ]);

  // Advanced options - only shown if user wants to see them
  const { showAdvanced } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'showAdvanced',
      message: 'Would you like to configure advanced options?',
      default: false,
    }
  ]);

  let advancedAnswers = {};
  
  if (showAdvanced) {
    advancedAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'startDate',
        message: 'Start date (YYYY-MM-DD, leave empty for 1 year ago):',
        default: '',
        validate: (value) => {
          if (!value) return true;
          return DateTime.fromFormat(value, 'yyyy-MM-dd').isValid 
            ? true 
            : 'Please enter a valid date in YYYY-MM-DD format';
        }
      },
      {
        type: 'input',
        name: 'endDate',
        message: 'End date (YYYY-MM-DD, leave empty for today):',
        default: '',
        validate: (value) => {
          if (!value) return true;
          return DateTime.fromFormat(value, 'yyyy-MM-dd').isValid 
            ? true 
            : 'Please enter a valid date in YYYY-MM-DD format';
        }
      },
      {
        type: 'number',
        name: 'commitFrequency',
        message: 'How many commits per active day?',
        default: defaultConfig.commitFrequency || 1,
        validate: (value) => value > 0 ? true : 'Please enter a positive number',
      },
      {
        type: 'confirm',
        name: 'simulateVacations',
        message: 'Simulate vacation periods (periods with no commits)?',
        default: defaultConfig.simulateVacations || false,
      },
      {
        type: 'confirm',
        name: 'respectHolidays',
        message: 'Respect holidays (fewer commits on holidays)?',
        default: defaultConfig.respectHolidays || false,
      },
      {
        type: 'input',
        name: 'repoPath',
        message: 'Path to the repository:',
        default: defaultConfig.repoPath || '.',
      },
      {
        type: 'confirm',
        name: 'pushToRemote',
        message: 'Push commits to remote repository?',
        default: defaultConfig.pushToRemote !== false,
      },
    ]);
  }

  // Merge all answers into a configuration object
  const config: Partial<GraphifyConfig> = {
    ...defaultConfig,
    ...setupAnswers,
    ...advancedAnswers,
  };

  // Validate the configuration
  const validationResult = validateConfig(config);
  
  if (!validationResult.isValid) {
    console.log(chalk.red('\n❌ Configuration validation failed:'));
    
    // Display validation errors in a table
    const table = new Table({
      head: [chalk.yellow('Field'), chalk.yellow('Error')],
      colWidths: [20, 60],
    });
    
    validationResult.errors.forEach(error => {
      table.push([error.field, error.message]);
    });
    
    console.log(table.toString());
    
    const { retry } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'retry',
        message: 'Would you like to try again?',
        default: true,
      }
    ]);
    
    if (retry) {
      return launchInteractiveMode(config);
    } else {
      console.log(chalk.yellow('Operation canceled.'));
      return;
    }
  }

  // Show confirmation with summary
  console.log(chalk.green('\n📋 Configuration Summary:'));
  
  const summaryTable = new Table();
  
  summaryTable.push(
    { 'Pattern': chalk.cyan(config.pattern) },
    { 'Commits': chalk.cyan(config.commitCount) },
    { 'Active Days': chalk.cyan(config.activeDays?.map(getDayName).join(', ')) },
    { 'Time of Day': chalk.cyan(config.timeOfDay) },
    { 'Repository': chalk.cyan(config.repoPath) },
    { 'Push to Remote': config.pushToRemote ? chalk.green('Yes') : chalk.red('No') }
  );
  
  console.log(summaryTable.toString());

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Ready to generate your contribution pattern?',
      default: true,
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('Operation canceled.'));
    return;
  }

  // Run the generation process
  const spinner = ora('Generating contribution pattern...').start();
  
  try {
    // Execute graph generation
    await generateGraph(config as GraphifyConfig);
    
    spinner.succeed(chalk.green('Contribution pattern generated successfully!'));
    
    // Show success message with helpful links
    console.log('\n' + chalk.bgGreen.black(' SUCCESS ') + ' Your GitHub graph has been modified.');
    
    if (config.pushToRemote) {
      console.log('\nCheck your GitHub profile to see the changes:');
      console.log(terminalLink('View GitHub Profile', 'https://github.com/' + await getGitHubUsername(config.repoPath)));
    } else {
      console.log('\nLocal commits created. Push manually when ready:');
      console.log(chalk.gray('  git push origin main'));
    }
    
    // Save session for future use
    await saveSession(config);
    
  } catch (error) {
    spinner.fail(chalk.red('Error generating contribution pattern'));
    console.error('\n' + chalk.red('Error details:'), error);
    
    const { showHelp } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'showHelp',
        message: 'Would you like to see troubleshooting tips?',
        default: true,
      }
    ]);
    
    if (showHelp) {
      showTroubleshootingTips(error);
    }
  }
}

/**
 * Get day name from day number
 * @param day Day number (0-6)
 * @returns Day name
 */
function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || `Unknown day ${day}`;
}

/**
 * Get GitHub username from repository
 * @param repoPath Repository path
 * @returns GitHub username
 */
async function getGitHubUsername(repoPath = '.'): Promise<string> {
  try {
    // This is a placeholder - real implementation would parse git remote to get username
    return 'username';
  } catch (error) {
    return 'your-username';
  }
}

/**
 * Save session for future use
 * @param config Configuration to save
 */
async function saveSession(config: Partial<GraphifyConfig>): Promise<void> {
  try {
    const { saveConfig } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveConfig',
        message: 'Would you like to save this configuration for future use?',
        default: true,
      }
    ]);
    
    if (saveConfig) {
      // Save to user preferences
      const userConfigPath = '.graphify-config.json';
      await writeFile(userConfigPath, JSON.stringify(config, null, 2));
      console.log(chalk.green(`✓ Configuration saved to ${userConfigPath}`));
    }
  } catch (error) {
    console.log(chalk.yellow('Could not save configuration: '), error);
  }
}

/**
 * Show troubleshooting tips for common errors
 * @param error Error object
 */
function showTroubleshootingTips(error: any): void {
  console.log(chalk.blue('\n🔧 Troubleshooting Tips:'));
  
  const tipsTable = new Table({
    colWidths: [30, 50],
  });
  
  // Git related issues
  if (error.message?.includes('git')) {
    tipsTable.push(
      [chalk.yellow('Git Repository Issues'), 'Make sure you\'re running this in a git repository'],
      ['', 'Check if you have the correct permissions'],
      ['', 'Try running: git status']
    );
  }
  
  // GitHub API issues
  if (error.message?.includes('API') || error.message?.includes('GitHub')) {
    tipsTable.push(
      [chalk.yellow('GitHub API Issues'), 'Check your internet connection'],
      ['', 'Make sure your GitHub credentials are correct'],
      ['', 'You might be hitting GitHub API rate limits']
    );
  }
  
  // File permission issues
  if (error.message?.includes('permission') || error.message?.includes('EPERM')) {
    tipsTable.push(
      [chalk.yellow('Permission Issues'), 'Make sure you have write access to the directory'],
      ['', 'Try running with elevated permissions (but be careful)']
    );
  }
  
  // Generic issues
  tipsTable.push(
    [chalk.yellow('General Troubleshooting'), 'Try with a simpler configuration'],
    ['', 'Make sure you have Node.js 14 or newer'],
    ['', 'Update Graphify to the latest version']
  );
  
  console.log(tipsTable.toString());
  
  console.log(chalk.blue('\nNeed more help?'));
  console.log(`Visit ${terminalLink('Graphify Documentation', 'https://github.com/iiXXiXii/Graphify#troubleshooting')}`);
} 