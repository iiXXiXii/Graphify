#!/usr/bin/env node

import { Graphify } from './Graphify';
import defaultConfig, { GraphifyConfig, TimeOfDayPreference, CommitPatternType } from './config/default';
import path from 'path';
import fs from 'fs';

// Get version from package.json
const PACKAGE_VERSION = '1.0.0';

/**
 * Initialize with custom configuration
 * @param customConfig Custom configuration options
 * @returns Promise resolving when Graphify completes
 */
async function initialize(customConfig: Partial<GraphifyConfig> = {}): Promise<void> {
  // Merge default config with custom config
  const config: GraphifyConfig = {
    ...defaultConfig,
    ...customConfig,
  };

  console.log('\n🌟 Graphify - GitHub Contribution Graph Generator 🌟');
  console.log('---------------------------------------------');
  
  // Create Graphify instance
  const graphify = new Graphify(config);

  try {
    // Run the process
    await graphify.run();
    
    // Finalize with a current date commit
    await graphify.finalize();
    
    console.log('\n✅ Graphify process completed successfully!');
  } catch (error) {
    console.error('\n❌ Error running Graphify:', error);
    process.exit(1);
  }
}

/**
 * Command line entry point
 */
function main(): void {
  const args = process.argv.slice(2);
  const options: Partial<GraphifyConfig> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Basic options
    if (arg === '--count' && i + 1 < args.length) {
      options.commitCount = parseInt(args[++i], 10);
    } else if (arg === '--repo' && i + 1 < args.length) {
      options.repoPath = args[++i];
    } else if (arg === '--data-file' && i + 1 < args.length) {
      options.dataFilePath = args[++i];
    } else if (arg === '--branch' && i + 1 < args.length) {
      options.remoteBranch = args[++i];
    } else if (arg === '--max-weeks' && i + 1 < args.length) {
      options.maxWeeks = parseInt(args[++i], 10);
    } else if (arg === '--max-days' && i + 1 < args.length) {
      options.maxDays = parseInt(args[++i], 10);
      
    // Pattern options  
    } else if (arg === '--pattern' && i + 1 < args.length) {
      const pattern = args[++i];
      const validPatterns: CommitPatternType[] = [
        'random', 'gradient', 'snake', 'heart', 'realistic', 'steady', 'crescendo', 'custom'
      ];
      
      if (validPatterns.includes(pattern as CommitPatternType)) {
        options.pattern = pattern as CommitPatternType;
      } else {
        console.error(`Invalid pattern: ${pattern}. Using default.`);
      }
    } else if (arg === '--frequency' && i + 1 < args.length) {
      options.commitFrequency = parseInt(args[++i], 10);
    } else if (arg === '--active-days' && i + 1 < args.length) {
      try {
        options.activeDays = args[++i].split(',').map(day => parseInt(day, 10));
      } catch (e) {
        console.error('Invalid active-days format. Should be comma-separated numbers (0-6)');
      }
      
    // Time options  
    } else if (arg === '--time-of-day' && i + 1 < args.length) {
      const timeOfDay = args[++i];
      const validTimes: TimeOfDayPreference[] = [
        'morning', 'afternoon', 'evening', 'night', 'random', 'working-hours', 'after-hours'
      ];
      
      if (validTimes.includes(timeOfDay as TimeOfDayPreference)) {
        options.timeOfDay = timeOfDay as TimeOfDayPreference;
      } else {
        console.error(`Invalid time-of-day: ${timeOfDay}. Using default.`);
      }
    } else if (arg === '--min-time-between' && i + 1 < args.length) {
      options.minTimeBetweenCommits = parseInt(args[++i], 10);
      
    // Date range options  
    } else if (arg === '--start-date' && i + 1 < args.length) {
      options.startDate = args[++i];
    } else if (arg === '--end-date' && i + 1 < args.length) {
      options.endDate = args[++i];
      
    // Simulation options
    } else if (arg === '--simulate-vacations') {
      options.simulateVacations = true;
    } else if (arg === '--vacation-count' && i + 1 < args.length) {
      options.vacationCount = parseInt(args[++i], 10);
    } else if (arg === '--max-vacation-length' && i + 1 < args.length) {
      options.maxVacationLength = parseInt(args[++i], 10);
    } else if (arg === '--respect-holidays') {
      options.respectHolidays = true;
    } else if (arg === '--holiday-country' && i + 1 < args.length) {
      options.holidayCountry = args[++i];
    } else if (arg === '--simulate-dev-cycles') {
      options.simulateDevelopmentCycles = true;
    } else if (arg === '--cycle-length' && i + 1 < args.length) {
      options.developmentCycleLength = parseInt(args[++i], 10);
    } else if (arg === '--project-lifecycle' && i + 1 < args.length) {
      const lifecycle = args[++i];
      if (['startup', 'maintenance', 'active-development', 'none'].includes(lifecycle)) {
        options.projectLifecycleSimulation = lifecycle as any;
      } else {
        console.error(`Invalid project-lifecycle: ${lifecycle}. Using default.`);
      }
      
    // Commit message options
    } else if (arg === '--commit-messages' && i + 1 < args.length) {
      const filePath = args[++i];
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          options.commitMessages = content.split('\n').filter(line => line.trim() !== '');
          console.log(`Loaded ${options.commitMessages.length} commit message templates from ${filePath}`);
        } else {
          console.error(`Commit messages file not found: ${filePath}`);
        }
      } catch (error) {
        console.error(`Error reading commit messages file: ${error}`);
      }
      
    // Safety options  
    } else if (arg === '--no-push') {
      options.pushToRemote = false;
    } else if (arg === '--allow-future-commits') {
      options.preventFutureCommits = false;
      console.warn('⚠️ Warning: Future-dated commits enabled. This may look suspicious on GitHub.');
    } else if (arg === '--no-realistic-timestamps') {
      options.useRealisticTimestamps = false;
    } else if (arg === '--no-validation') {
      options.validateRealism = false;
    } else if (arg === '--no-analytics') {
      options.showAnalytics = false;
      
    // Help and version  
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (arg === '--version' || arg === '-v') {
      console.log(`Graphify v${PACKAGE_VERSION}`);
      process.exit(0);
    } else if (arg === '--advanced-help') {
      printAdvancedHelp();
      process.exit(0);
    }
  }

  // Initialize with parsed options
  initialize(options).catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log(`
Graphify v${PACKAGE_VERSION} - GitHub contribution graph generator

Usage:
  graphify [options]

Basic Options:
  --count <number>       Number of commits to generate (default: 100)
  --repo <path>          Path to local git repository (default: current directory)
  --data-file <path>     Path to data file (default: ./data.json)
  --branch <name>        Remote branch name (auto-detected, defaults to main)
  --pattern <name>       Commit pattern: random, gradient, snake, heart, realistic, steady, crescendo
  --no-push              Don't push to remote repository
  --help, -h             Show this help message
  --advanced-help        Show all advanced options
  --version, -v          Show version

Examples:
  graphify --count 150 --pattern gradient
  graphify --active-days 0,6 --frequency 3  # Weekend warrior mode
  graphify --no-push                        # Commits without pushing to remote
  graphify --start-date 2023-01-01 --end-date 2023-12-31  # Custom date range
  graphify --pattern realistic --simulate-vacations  # Realistic developer pattern
  `);
}

/**
 * Print advanced help information
 */
function printAdvancedHelp(): void {
  console.log(`
Graphify v${PACKAGE_VERSION} - Advanced Options

Pattern & Distribution:
  --pattern <name>       Commit pattern type:
                           - random: Random distribution
                           - gradient: More commits in recent dates
                           - snake: Zigzag pattern across the graph
                           - heart: More commits in the middle of the range
                           - realistic: Simulates typical developer activity
                           - steady: Consistent commit frequency
                           - crescendo: Gradually increasing activity
  --frequency <number>   How many commits per active day (default: 1)
  --active-days <list>   Days of week for commits, comma-separated: 0=Sun, 6=Sat (default: 1,2,3,4,5)
  
Time Settings:
  --time-of-day <time>   When to make commits:
                           - morning: 8am-12pm
                           - afternoon: 1pm-5pm
                           - evening: 6pm-10pm
                           - night: 10pm-12am
                           - working-hours: 9am-6pm (default)
                           - after-hours: 6pm-8am
                           - random: Any time
  --min-time-between <min> Minimum minutes between commits on same day (default: 30)
  --no-realistic-timestamps Disable realistic time generation

Date Range:
  --start-date <date>    Start date for commits in ISO format (default: 1 year ago)
  --end-date <date>      End date for commits in ISO format (default: today)
  --max-weeks <number>   Maximum weeks for random date generation (default: 52)
  --max-days <number>    Maximum days for random date generation (default: 6)

Realism Features:
  --simulate-vacations   Add periods with no commits to simulate vacations
  --vacation-count <n>   Number of vacation periods to generate (default: 2)
  --max-vacation-length <n> Maximum vacation length in days (default: 14)
  --respect-holidays     Skip commits on common holidays
  --holiday-country <code> Country code for holidays (default: US)
  --simulate-dev-cycles  Simulate development cycle activity patterns
  --cycle-length <n>     Length of development cycle in days (default: 14)
  --project-lifecycle <type> Adjust activity based on project lifecycle:
                           - startup: More activity at beginning
                           - maintenance: Low activity with occasional spikes
                           - active-development: Consistent high activity
                           - none: No lifecycle simulation (default)

Commit Messages:
  --commit-messages <file> File with commit message templates (one per line)

Safety Features:
  --allow-future-commits Allows commits with future dates (NOT RECOMMENDED)
  --no-validation        Disable commit distribution validation
  --no-analytics         Disable analytics report generation
  `);
}

// Run main function if this file is executed directly
if (require.main === module) {
  main();
}

// Export for use as module
export { initialize, Graphify };
export default initialize; 