import chalk from 'chalk';
import { Command } from 'commander';
import { AuthService } from '../auth/auth.service.js';
import inquirer from 'inquirer';

const authService = new AuthService();

/**
 * Initializes the auth commands
 */
export function initAuthCommands(program: Command): void {
  const auth = program.command('auth')
    .description('Authenticate with GitHub')
    .action(async (options) => {
      // Default action is to login
      try {
        const isAuthenticated = await authService.isAuthenticated();

        if (isAuthenticated) {
          const userInfo = await authService.getUserInfo();
          console.log(chalk.green('✓ Already authenticated with GitHub'));
          if (userInfo && userInfo.username) {
            console.log(chalk.blue(`Logged in as: ${userInfo.username}`));

            // Ask if they want to re-authenticate
            const answers = await inquirer.prompt([{
              type: 'confirm',
              name: 'reauth',
              message: 'Do you want to re-authenticate?',
              default: false
            }]);

            if (answers.reauth) {
              await authService.authenticateWithGitHub();
            }
          }
        } else {
          // Not authenticated, start the flow
          await authService.authenticateWithGitHub();
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(chalk.red('Authentication failed:'), error.message);
        process.exit(1);
      }
    });

  // Subcommands for more specific operations
  auth.command('status')
    .description('Check authentication status')
    .action(async () => {
      try {
        const isAuthenticated = await authService.isAuthenticated();
        if (isAuthenticated) {
          const userInfo = await authService.getUserInfo();
          console.log(chalk.green('✓ Authenticated with GitHub'));
          if (userInfo && userInfo.username) {
            console.log(chalk.blue(`Logged in as: ${userInfo.username}`));
          }
        } else {
          console.log(chalk.yellow('Not authenticated with GitHub'));
          console.log(`Run ${chalk.blue('graphify auth')} to authenticate`);
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(chalk.red('Failed to check authentication status:'), error.message);
        process.exit(1);
      }
    });

  auth.command('logout')
    .description('Logout from GitHub')
    .action(async () => {
      try {
        await authService.logout();
        console.log(chalk.yellow('You have been logged out from GitHub'));
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(chalk.red('Logout failed:'), error.message);
        process.exit(1);
      }
    });

  auth.command('reset')
    .description('Reset authentication (clear all stored credentials)')
    .action(async () => {
      try {
        await authService.logout();
        console.log(chalk.green('Authentication data has been reset'));
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(chalk.red('Reset failed:'), error.message);
        process.exit(1);
      }
    });

  auth.command('token')
    .description('Manually set GitHub personal access token (advanced)')
    .action(async () => {
      try {
        console.log(chalk.yellow('⚠ Advanced: Using a personal access token directly'));
        console.log(chalk.yellow('We recommend using the standard authentication flow instead.'));
        console.log(chalk.yellow('Your token must have the "repo" scope to work properly.\n'));

        const answers = await inquirer.prompt([{
          type: 'password',
          name: 'token',
          message: 'Enter your GitHub personal access token:',
          validate: input => input.length > 0 ? true : 'Token cannot be empty'
        }]);

        // Save the token
        await authService.saveAuthData({
          accessToken: answers.token,
          scope: ['repo'] // Assume minimal permissions
        });

        // Verify the token works by getting user info
        const userInfo = await authService.getUserInfo();
        if (userInfo && userInfo.username) {
          console.log(chalk.green(`✓ Token saved successfully and verified. Logged in as ${userInfo.username}`));
        } else {
          console.log(chalk.yellow('⚠ Token saved, but could not verify GitHub user information'));
        }
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(chalk.red('Failed to set token:'), error.message);
        process.exit(1);
      }
    });
}
