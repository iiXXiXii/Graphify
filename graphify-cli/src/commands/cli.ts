import { Command } from '@oclif/core';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import { isAuthenticated } from './auth';

export default class CLI extends Command {
  static description = 'Graphify CLI for creating GitHub contribution patterns';

  static examples = [
    '$ graphify auth',
    '$ graphify pattern create',
    '$ graphify commit --pattern pattern.json',
    '$ graphify',
  ];

  // No flags for the base command - it will run interactive mode
  static flags = {};

  async run(): Promise<void> {
    // Welcome message
    this.displayWelcomeBanner();

    try {
      // Check authentication status
      await this.checkAuth();

      // Display main menu
      await this.showMainMenu();
    } catch (error) {
      this.handleError(error);
    }
  }

  private displayWelcomeBanner(): void {
    console.log(chalk.green('┌───────────────────────────────────────────┐'));
    console.log(chalk.green('│                                           │'));
    console.log(chalk.green('│           ') + chalk.bold.green('GRAPHIFY CLI') + chalk.green('                │'));
    console.log(chalk.green('│     Create GitHub contribution patterns   │'));
    console.log(chalk.green('│                                           │'));
    console.log(chalk.green('└───────────────────────────────────────────┘'));
    console.log('');
  }

  private async checkAuth(): Promise<void> {
    // Check if user is authenticated
    const isUserAuthenticated = isAuthenticated();

    if (!isUserAuthenticated) {
      console.log(chalk.yellow('You are not authenticated with GitHub.'));

      const { shouldAuth } = await inquirer.prompt({
        type: 'confirm',
        name: 'shouldAuth',
        message: 'Would you like to authenticate now?',
        default: true,
      });

      if (shouldAuth) {
        try {
          await this.config.runCommand('auth');
          console.log(chalk.green('✓ Authentication successful!'));
        } catch (error) {
          console.log(chalk.yellow('Authentication skipped. Some features may be limited.'));
        }
      } else {
        console.log(chalk.yellow('Authentication skipped. Some features may be limited.'));
      }
    } else {
      console.log(chalk.green('✓ Authenticated with GitHub'));
    }
  }

  private async showMainMenu(): Promise<void> {
    // Define the main menu options
    const menuOptions = [
      {
        name: 'Authentication',
        value: 'auth',
        description: 'Manage GitHub authentication',
      },
      {
        name: 'Create Pattern',
        value: 'pattern-create',
        description: 'Design a new contribution pattern',
      },
      {
        name: 'Import Pattern',
        value: 'import',
        description: 'Import a pattern from a file',
      },
      {
        name: 'Create Commits',
        value: 'commit',
        description: 'Generate commits based on a pattern',
      },
      {
        name: 'Exit',
        value: 'exit',
        description: 'Exit Graphify CLI',
      },
    ];

    // Loop until user exits
    let exit = false;
    while (!exit) {
      const { action } = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: menuOptions.map(option => ({
          name: `${option.name} - ${chalk.dim(option.description)}`,
          value: option.value,
          short: option.name,
        })),
      });

      if (action === 'exit') {
        exit = true;
        console.log(chalk.blue('Goodbye! 👋'));
      } else {
        await this.executeCommand(action);
      }
    }
  }

  private async executeCommand(command: string): Promise<void> {
    try {
      // Map menu options to actual commands
      const commandMappings: Record<string, string> = {
        'auth': 'auth',
        'pattern-create': 'pattern create',
        'import': 'import',
        'commit': 'commit',
      };

      // Run the selected command
      if (commandMappings[command]) {
        // Print a separator
        console.log('\n' + chalk.dim('─'.repeat(50)) + '\n');

        // Run the command
        await this.config.runCommand(commandMappings[command]);

        // Add a "press any key to continue" prompt
        console.log('\n');
        await inquirer.prompt({
          type: 'input',
          name: 'continue',
          message: 'Press Enter to return to the main menu...',
        });
      } else {
        console.error(chalk.red(`Unknown command: ${command}`));
      }
    } catch (error) {
      this.handleError(error);

      // Wait for user acknowledgment before returning to menu
      await inquirer.prompt({
        type: 'input',
        name: 'continue',
        message: 'Press Enter to return to the main menu...',
      });
    }
  }

  private handleError(error: any): void {
    // Extract the error message
    const errorMessage = error?.message || 'Unknown error';

    // Log the error with appropriate formatting
    console.error(chalk.red('\n❌ Error:'), errorMessage);

    // Add debugging info in verbose mode
    if (process.env.DEBUG || process.env.GRAPHIFY_DEBUG) {
      console.error(chalk.gray('\nDebug information:'));
      console.error(chalk.gray(error?.stack || 'No stack trace available'));
    } else {
      console.error(chalk.dim('\nTip: Run with DEBUG=true for more information.'));
    }
  }
}
