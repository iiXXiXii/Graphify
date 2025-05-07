#!/usr/bin/env bun
import { Command } from 'commander';
import chalk from 'chalk';
import { setupAuthCommand } from './commands/auth-command';
import { setupPatternCommand } from './commands/pattern-command';
import { setupCommitCommand } from './commands/commit-command';
import { setupImportCommand } from './commands/import-command';

// Create the main CLI program
const program = new Command();

// Configure the program
program
  .name('graphify')
  .description('CLI tool for customizing your GitHub contribution graph')
  .version('1.0.0');

// Register commands
setupAuthCommand(program);
setupPatternCommand(program);
setupCommitCommand(program);
setupImportCommand(program);

// Add global options
program
  .option('-v, --verbose', 'Enable verbose output')
  .option('--debug', 'Enable debug mode');

// Handle custom help formatting
program.helpOption('-h, --help', 'Display help information');

// Parse arguments
program.parse(process.argv);

// Set up global verbose/debug mode based on options
const options = program.opts();
if (options.verbose) {
  process.env.VERBOSE = 'true';
}
if (options.debug) {
  process.env.DEBUG = 'true';
}

// If no arguments are provided, show help
if (!process.argv.slice(2).length) {
  displayBanner();
  program.outputHelp();
}

// Display a banner for the CLI
function displayBanner() {
  console.log(chalk.green('┌───────────────────────────────────────────┐'));
  console.log(chalk.green('│                                           │'));
  console.log(chalk.green('│           ') + chalk.bold.green('GRAPHIFY CLI') + chalk.green('                │'));
  console.log(chalk.green('│     Create GitHub contribution patterns   │'));
  console.log(chalk.green('│                                           │'));
  console.log(chalk.green('└───────────────────────────────────────────┘'));
  console.log('');
}
