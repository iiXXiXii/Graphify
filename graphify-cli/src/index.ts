#!/usr/bin/env bun
import { Command } from 'commander';
import { authCommand } from './commands/auth';
import { commitCommand } from './commands/commit';
import { importCommand } from './commands/import';
import { patternCommand } from './commands/pattern';

const program = new Command();

program
  .name('graphify')
  .description('CLI tool for customizing your GitHub contribution graph')
  .version('1.0.0');

// Register commands
authCommand(program);
commitCommand(program);
importCommand(program);
patternCommand(program);

// Handle custom help formatting if needed
program.helpOption('-h, --help', 'Display help information');

program.parse(process.argv);

// If no arguments are provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
