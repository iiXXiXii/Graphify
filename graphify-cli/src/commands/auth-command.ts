import chalk from 'chalk';
import { Command } from 'commander';
import { AuthService } from '../auth/auth.service';
import inquirer from 'inquirer';

const authService = new AuthService();

/**
 * Initializes the auth commands
 */
export function initAuthCommands(program: Command): void {
  const auth = program.command('auth')
    .description('Authentication related commands');

  auth.command('login')
    .description('Login with GitHub')
    .action(async () => {
      try {
        await authService.authenticateWithGitHub();
        console.log(chalk.green('Successfully authenticated with GitHub'));
      } catch (err) {
        const error = err as Error;
        console.error(chalk.red('Authentication failed:'), error.message);
        process.exit(1);
      }
    });

  auth.command('logout')
    .description('Logout from GitHub')
    .action(async () => {
      try {
        await authService.logout();
        console.log(chalk.yellow('You have been logged out from GitHub'));
      } catch (err) {
        const error = err as Error;
        console.error(chalk.red('Logout failed:'), error.message);
        process.exit(1);
      }
    });

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
          console.log(`Run ${chalk.blue('graphify auth login')} to authenticate`);
        }
      } catch (err) {
        const error = err as Error;
        console.error(chalk.red('Failed to check authentication status:'), error.message);
        process.exit(1);
      }
    });

  auth.command('token')
    .description('Manually set GitHub personal access token')
    .action(async () => {
      try {
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
      } catch (err) {
        const error = err as Error;
        console.error(chalk.red('Failed to set token:'), error.message);
        process.exit(1);
      }
    });
}
