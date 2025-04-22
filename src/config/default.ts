/**
 * Graphify Configuration
 */

export type CommitPatternType = 
  | 'random' 
  | 'gradient' 
  | 'snake' 
  | 'heart' 
  | 'realistic' 
  | 'steady' 
  | 'crescendo' 
  | 'custom';

export type TimeOfDayPreference = 
  | 'morning' 
  | 'afternoon' 
  | 'evening' 
  | 'night' 
  | 'random' 
  | 'working-hours' 
  | 'after-hours';

export interface GraphifyConfig {
  /** Path to data file that will be updated with each commit */
  dataFilePath: string;
  /** Path to the local git repository */
  repoPath: string;
  /** Remote branch to push to */
  remoteBranch: string;
  /** Remote name (e.g., 'origin') */
  remoteName?: string;
  /** Whether to push to remote repository */
  pushToRemote?: boolean;
  /** Number of commits to make */
  commitCount: number;
  /** Start date from which to generate commits (in ISO format) */
  startDate?: string;
  /** End date until which to generate commits (in ISO format) */
  endDate?: string;
  /** Maximum weeks back for random date generation */
  maxWeeks: number;
  /** Maximum days back within the week for random date generation */
  maxDays: number;
  /** Pattern to use for commit generation */
  pattern?: CommitPatternType;
  /** Custom pattern data when pattern is set to 'custom' */
  customPattern?: number[][];
  /** Commit frequency - how many commits per active day */
  commitFrequency?: number;
  /** Days of week to focus commits on (0 = Sunday, 6 = Saturday) */
  activeDays?: number[];
  /** Time of day preference for commits */
  timeOfDay?: TimeOfDayPreference;
  /** Minimum time between commits on the same day (in minutes) */
  minTimeBetweenCommits?: number;
  /** Custom commit message templates */
  commitMessages?: string[];
  /** Simulate vacation periods with no commits */
  simulateVacations?: boolean;
  /** Number of vacation periods to simulate */
  vacationCount?: number;
  /** Maximum vacation length in days */
  maxVacationLength?: number;
  /** Enable/disable holiday awareness */
  respectHolidays?: boolean;
  /** Country code for holiday awareness (e.g., 'US', 'UK') */
  holidayCountry?: string;
  /** Simulate natural developer cycle (more commits during sprints, fewer during planning) */
  simulateDevelopmentCycles?: boolean;
  /** Length of development cycle in days */
  developmentCycleLength?: number;
  /** Force use of realistic timestamps (no commits at 3am unless specified) */
  useRealisticTimestamps?: boolean;
  /** Whether to prevent future-dated commits (recommended: true) */
  preventFutureCommits?: boolean;
  /** Whether to validate commit distribution for realism */
  validateRealism?: boolean;
  /** Whether to show analytics of the generated commit pattern */
  showAnalytics?: boolean;
  /** Adjust commit activity based on typical project lifecycle */
  projectLifecycleSimulation?: 'startup' | 'maintenance' | 'active-development' | 'none';
  /** Use a GitHub username as a template for commit patterns */
  templateGitHubUser?: string;
}

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