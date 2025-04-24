/**
 * Modern Graphify CLI entry (uses Commander)
 */
import { Command } from 'commander';
import { GraphifyConfig } from '../types/config.js';
import defaultConfig from '../config/default.js';
import { ErrorHandler, ErrorCategory, GraphifyError } from '../utils/errorHandler.js';
import { Graphify } from '../Graphify.js';
import PluginRegistry from '../plugins/interface.js';
import RandomPatternPlugin from '../plugins/randomPattern.js';
import RealisticPatternPlugin from '../plugins/realisticPattern.js';

// Version from package.json (hardcoded for simplicity)
const PACKAGE_VERSION = '1.1.0';

/**
 * Initialize required plugins
 */
function initializePlugins(): void {
  const registry = PluginRegistry.getInstance();
  registry.registerPattern(new RandomPatternPlugin());
  registry.registerPattern(new RealisticPatternPlugin());
}

/**
 * Run the CLI with the given arguments
 * @param args Command line arguments
 */
export async function runCLI(args = process.argv): Promise<void> {
  try {
    // Initialize plugins
    initializePlugins();

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
      .option('-b, --branch <name>', 'Remote branch name', defaultConfig.remoteBranch)
      .option('-s, --start-date <date>', 'Start date (YYYY-MM-DD), defaults to 1 year ago')
      .option('-e, --end-date <date>', 'End date (YYYY-MM-DD), defaults to today')
      .option('-f, --frequency <number>', 'Commits per active day', String(defaultConfig.commitFrequency))
      .option('-a, --active-days <days>', 'Active days of week (0-6, comma separated)', defaultConfig.activeDays?.join(','))
      .option('-t, --time-of-day <preference>', 'Time of day preference', defaultConfig.timeOfDay)
      .option('--simulate-vacations', 'Simulate vacation periods')
      .option('--respect-holidays', 'Respect holidays (fewer commits on holidays)')
      .option('--holiday-country <code>', 'Country for holiday awareness', 'US')
      .option('--simulate-dev-cycles', 'Simulate development cycles')
      .option('--project-lifecycle <type>', 'Project lifecycle simulation')
      .option('--no-push', 'Disable pushing to remote repository')
      .option('--no-validation', 'Disable commit distribution validation')
      .option('--data-file <path>', 'Path to data file', defaultConfig.dataFilePath)
      .action(async (options) => {
        try {
          // Parse active days if provided
          let activeDays = defaultConfig.activeDays;
          if (options.activeDays) {
            activeDays = options.activeDays.split(',').map((day: string) => parseInt(day.trim(), 10));
          }

          // Build configuration
          const config: Partial<GraphifyConfig> = {
            commitCount: parseInt(options.count, 10),
            pattern: options.pattern,
            repoPath: options.repo,
            remoteBranch: options.branch,
            pushToRemote: options.push,
            startDate: options.startDate,
            endDate: options.endDate,
            commitFrequency: parseInt(options.frequency, 10),
            activeDays,
            timeOfDay: options.timeOfDay,
            simulateVacations: options.simulateVacations || false,
            respectHolidays: options.respectHolidays || false,
            holidayCountry: options.holidayCountry,
            simulateDevelopmentCycles: options.simulateDevCycles || false,
            projectLifecycleSimulation: options.projectLifecycle || 'none',
            validateRealism: options.validation,
            dataFilePath: options.dataFile
          };

          console.log('\n🌟 Graphify - GitHub Contribution Graph Generator 🌟');
          console.log('---------------------------------------------');

          // Create and run Graphify instance
          const graphify = new Graphify({
            ...defaultConfig,
            ...config
          } as GraphifyConfig);

          await graphify.run();
          await graphify.finalize();

          console.log('\n✅ Graphify process completed successfully!');
        } catch (error) {
          ErrorHandler.getInstance().handle(error);
          process.exit(1);
        }
      });

    // Information command
    program
      .command('info')
      .description('Show information about available patterns')
      .action(() => {
        console.log('\n🌟 Graphify Patterns Information 🌟');
        console.log('---------------------------------------------');

        const registry = PluginRegistry.getInstance();
        const patterns = registry.getAllPatterns();

        console.log(`Available patterns (${patterns.length}):\n`);

        for (const pattern of patterns) {
          console.log(`- ${pattern.name}: ${pattern.description}`);
        }

        console.log('\nExample usage:');
        console.log('  graphify --pattern random --count 100');
        console.log('  graphify --pattern realistic --simulate-vacations --respect-holidays');
      });

    // Validate command
    program
      .command('validate')
      .description('Validate repository configuration')
      .option('-r, --repo <path>', 'Path to repository', defaultConfig.repoPath)
      .action(async (options) => {
        try {
          console.log('\n🔍 Validating Repository Configuration');
          console.log('---------------------------------------------');

          // Create temporary Graphify instance just for validation
          const graphify = new Graphify({
            ...defaultConfig,
            repoPath: options.repo
          } as GraphifyConfig);

          // Run validation
          const result = await graphify.validateRepository();

          if (result.valid) {
            console.log('✅ Repository validation successful!');
            console.log(`\nRepository: ${options.repo}`);
            console.log(`Branch: ${result.info.currentBranch}`);
            console.log(`Remotes: ${result.info.remotes.join(', ') || 'None'}`);
          } else {
            console.log('❌ Repository validation failed:');
            for (const error of result.errors) {
              console.log(`  - ${error}`);
            }
          }
        } catch (error) {
          ErrorHandler.getInstance().handle(error);
          process.exit(1);
        }
      });

    // Parse arguments
    program.parse(args);
  } catch (error) {
    ErrorHandler.getInstance().handle(error);
    process.exit(1);
  }
}
