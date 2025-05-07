import { Command } from 'commander';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import { authenticateWithGitHub, logout, getStorageLocation, isAuthenticated, getUserInfo } from '../auth';

export function setupAuthCommand(program: Command): void {
  const authCommand = program
    .command('auth')
    .description('Authenticate with GitHub');

  authCommand
    .command('login')
    .description('Log in to GitHub')
    .action(async () => {
      try {
        // Check if already authenticated
        const authenticated = await isAuthenticated();

        if (authenticated) {
          const userInfo = await getUserInfo();
          console.log(chalk.green(`✓ Already authenticated${userInfo ? ` as ${userInfo.username}` : ''}`));

          const { reauth } = await inquirer.prompt({
            type: 'confirm',
            name: 'reauth',
            message: 'Do you want to re-authenticate?',
            default: false,
          });

          if (!reauth) {
            return;
          }
        }

        await authenticateWithGitHub();
      } catch (error) {
        console.error(chalk.red('Authentication error:'), error.message);
        process.exit(1);
      }
    });

  authCommand
    .command('logout')
    .description('Log out from GitHub')
    .action(async () => {
      try {
        await logout();
        console.log(chalk.green('✓ Successfully logged out'));
      } catch (error) {
        console.error(chalk.red('Logout error:'), error.message);
        process.exit(1);
      }
    });

  authCommand
    .command('status')
    .description('Check authentication status')
    .action(async () => {
      try {
        const authenticated = await isAuthenticated();

        if (authenticated) {
          const userInfo = await getUserInfo();
          console.log(chalk.green('✓ Authenticated with GitHub'));

          if (userInfo?.username) {
            console.log(`Username: ${chalk.bold(userInfo.username)}`);
          }

          console.log(`Token stored in: ${getStorageLocation()}`);
        } else {
          console.log(chalk.yellow('✗ Not authenticated with GitHub'));
          console.log('Run "graphify auth login" to authenticate');
        }
      } catch (error) {
        console.error(chalk.red('Status check error:'), error.message);
        process.exit(1);
      }
    });

  // Default action when just 'auth' is run
  authCommand.action(async () => {
    try {
      const authenticated = await isAuthenticated();

      if (authenticated) {
        const userInfo = await getUserInfo();
        console.log(chalk.green(`✓ Already authenticated${userInfo ? ` as ${userInfo.username}` : ''}`));

        const { action } = await inquirer.prompt({
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Logout', value: 'logout' },
            { name: 'Re-authenticate', value: 'login' },
            { name: 'Exit', value: 'exit' }
          ]
        });

        if (action === 'logout') {
          await logout();
          console.log(chalk.green('✓ Successfully logged out'));
        } else if (action === 'login') {
          await authenticateWithGitHub();
        }
      } else {
        console.log(chalk.yellow('Not authenticated with GitHub.'));
        const { shouldAuth } = await inquirer.prompt({
          type: 'confirm',
          name: 'shouldAuth',
          message: 'Would you like to authenticate now?',
          default: true,
        });

        if (shouldAuth) {
          await authenticateWithGitHub();
        }
      }
    } catch (error) {
      console.error(chalk.red('Authentication error:'), error.message);
      process.exit(1);
    }
  });
}
