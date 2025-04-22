/**
 * Default configuration for Graphify
 */
import { GraphifyConfig } from '../types/config.js';

/**
 * Default configuration values
 */
const defaultConfig: GraphifyConfig = {
  dataFilePath: "./data.json",
  repoPath: ".", // Current directory
  remoteBranch: "main",
  commitCount: 100,
  maxWeeks: 52,
  maxDays: 6,
  pushToRemote: true, // By default, try to push to remote
  pattern: 'random',
  commitFrequency: 1,
  activeDays: [1, 2, 3, 4, 5], // Monday to Friday by default
  timeOfDay: 'working-hours',
  minTimeBetweenCommits: 30, // At least 30 minutes between commits
  useRealisticTimestamps: true,
  preventFutureCommits: true,
  validateRealism: true,
  simulateVacations: false,
  respectHolidays: false,
  showAnalytics: true,
  projectLifecycleSimulation: 'none',
};

export default defaultConfig;
