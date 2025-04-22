#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { version } from '../../package.json';
import { launchInteractiveMode } from './interactive';
import { generateCommand } from './commands/generate';
import { analyzeCommand } from './commands/analyze';
import { configureCommand } from './commands/configure';
import { validateCommand } from './commands/validate';
import { displayHelp } from './ui/help';
import { loadUserConfig, saveUserConfig } from '../config/user';

/**
 * Initialize the CLI interface
 */
export function initializeCLI(): void {
  // Create program
  const program = new Command();
  
  // Display banner
  console.log(
    chalk.greenBright(
      figlet.textSync('Graphify', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      })
    )
  );
  console.log(chalk.blue('GitHub Contribution Graph Generator'));
  console.log(chalk.gray(`Version ${version}\n`));

  // Set basic program info
  program
    .name('graphify')
    .description('Customizable GitHub contribution graph generator')
    .version(version, '-v, --version', 'Output the current version');
  
  // Load user configuration
  const userConfig = loadUserConfig();

  // Generate command
  program
    .command('generate')
    .alias('gen')
    .description('Generate commit patterns for your GitHub graph')
    .option('-c, --count <number>', 'Number of commits to generate', String(userConfig.commitCount || 100))
    .option('-p, --pattern <type>', 'Commit pattern type', userConfig.pattern || 'random')
    .option('-f, --frequency <number>', 'Commits per active day', String(userConfig.commitFrequency || 1))
    .option('-r, --repo <path>', 'Path to repository', userConfig.repoPath || '.')
    .option('-b, --branch <name>', 'Remote branch name', userConfig.remoteBranch || 'main')
    .option('--no-push', 'Disable pushing to remote repository')
    .option('-s, --start-date <date>', 'Start date in ISO format')
    .option('-e, --end-date <date>', 'End date in ISO format')
    .option('-a, --active-days <days>', 'Active days (0-6, comma separated)', userConfig.activeDays?.join(',') || '1,2,3,4,5')
    .option('-t, --time-of-day <time>', 'Time of day preference', userConfig.timeOfDay || 'working-hours')
    .option('--simulate-vacations', 'Simulate vacation periods')
    .option('--respect-holidays', 'Avoid commits on holidays')
    .option('--no-validation', 'Disable commit distribution validation')
    .option('--save-config', 'Save current settings as default')
    .action(async (options) => {
      await generateCommand(options);
      
      // Save configuration if requested
      if (options.saveConfig) {
        saveUserConfig({
          ...userConfig,
          commitCount: parseInt(options.count),
          pattern: options.pattern,
          commitFrequency: parseInt(options.frequency),
          repoPath: options.repo,
          remoteBranch: options.branch,
          pushToRemote: options.push,
          activeDays: options.activeDays.split(',').map((d: string) => parseInt(d)),
          timeOfDay: options.timeOfDay,
          simulateVacations: options.simulateVacations,
          respectHolidays: options.respectHolidays,
          validateRealism: options.validation,
        });
        console.log(chalk.green('✓ Configuration saved as default'));
      }
    });

  // Analyze command
  program
    .command('analyze')
    .alias('a')
    .description('Analyze your GitHub contribution pattern')
    .option('-u, --username <name>', 'GitHub username to analyze')
    .option('-r, --repo <path>', 'Path to local repository', '.')
    .option('-y, --year <year>', 'Year to analyze', String(new Date().getFullYear()))
    .option('--save-report', 'Save analysis report to file')
    .option('--format <type>', 'Report format (json, html, text)', 'text')
    .action(analyzeCommand);

  // Configure command
  program
    .command('configure')
    .alias('config')
    .description('Configure Graphify settings')
    .option('--reset', 'Reset to default settings')
    .option('--show', 'Show current configuration')
    .action(configureCommand);

  // Validate command
  program
    .command('validate')
    .description('Validate commit patterns for realism')
    .option('-r, --repo <path>', 'Path to repository', '.')
    .option('-t, --threshold <number>', 'Validation strictness (1-10)', '5')
    .action(validateCommand);

  // Interactive mode command (default)
  program
    .command('interactive', { isDefault: true })
    .description('Start interactive mode')
    .alias('i')
    .action(() => {
      launchInteractiveMode(userConfig);
    });

  // Custom help
  program.addHelpText('after', displayHelp());

  // Parse arguments
  program.parse();
}

// Execute if called directly
if (require.main === module) {
  initializeCLI();
} 