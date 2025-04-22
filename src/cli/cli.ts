/**
 * Modern Graphify CLI entry (uses Commander)
 */
import { Command } from 'commander';
import { GraphifyConfig } from '../types/config.js';
import { PACKAGE_VERSION } from '../index.js';
import defaultConfig from '../config/default.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { Graphify } from '../Graphify.js';

/**
 * Run the CLI with the given arguments
 * @param args Command line arguments
 */
export async function runCLI(args = process.argv): Promise<void> {
  // Create program
  const program = new Command();

  // Set basic program info
  program
    .name('graphify')
    .description('Customizable GitHub contribution graph generator')
    .version(PACKAGE_VERSION, '-v, --version', 'Output the current version');

  // Default command
  program
    .command('generate', { isDefault: true })
    .description('Generate commit patterns for your GitHub graph')
    .option('-c, --count <number>', 'Number of commits to generate', String(defaultConfig.commitCount))
    .option('-p, --pattern <type>', 'Commit pattern type', defaultConfig.pattern)
    .option('-r, --repo <path>', 'Path to repository', defaultConfig.repoPath)
    .option('--no-push', 'Disable pushing to remote repository')
    .action(async (options) => {
      try {
        const config: Partial<GraphifyConfig> = {
          commitCount: parseInt(options.count, 10),
          pattern: options.pattern,
          repoPath: options.repo,
          pushToRemote: options.push
        };

        // Create and run Graphify instance
        const graphify = new Graphify(config as GraphifyConfig);
        await graphify.run();
        await graphify.finalize();
      } catch (error) {
        ErrorHandler.getInstance().handle(error);
      }
    });

  // Parse arguments
  program.parse(args);
}

export default runCLI;
