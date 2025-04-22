/**
 * Available commit pattern types
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

/**
 * Time of day preferences for commit timestamps
 */
export type TimeOfDayPreference = 
  | 'morning'       // 8am-12pm
  | 'afternoon'     // 1pm-5pm
  | 'evening'       // 6pm-10pm
  | 'night'         // 10pm-2am
  | 'random'        // Any time
  | 'working-hours' // 9am-6pm
  | 'after-hours';  // 6pm-8am

/**
 * Project lifecycle simulation types
 */
export type ProjectLifecycleType = 
  | 'startup'           // More activity at beginning
  | 'maintenance'       // Low activity with occasional spikes
  | 'active-development' // Consistent high activity
  | 'none';             // No lifecycle simulation

/**
 * Country codes for holiday awareness
 */
export type CountryCode = 
  | 'US' | 'UK' | 'CA' | 'AU' 
  | 'DE' | 'FR' | 'JP' | 'CN' 
  | 'BR' | 'IN';

/**
 * Graphify configuration interface
 */
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
  holidayCountry?: CountryCode;
  
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
  projectLifecycleSimulation?: ProjectLifecycleType;
  
  /** Use a GitHub username as a template for commit patterns */
  templateGitHubUser?: string;
}

/**
 * Pattern definition interface for pattern generation
 */
export interface CommitPattern {
  /** Unique pattern identifier */
  id: CommitPatternType;
  
  /** Human-readable pattern name */
  name: string;
  
  /** Pattern description */
  description: string;
  
  /** 
   * Generator function for the pattern.
   * Takes total commits and returns a distribution matrix (weeks x days).
   */
  generate: (config: GraphifyConfig) => number[][];
}

/**
 * Analytics report structure
 */
export interface AnalyticsReport {
  /** Pattern used for generation */
  pattern: CommitPatternType;
  
  /** Total number of commits generated */
  totalCommits: number;
  
  /** Distribution of commits by date (date string -> count) */
  dateDistribution: Record<string, number>;
  
  /** Distribution of commits by day of week (0-6) */
  weekdayDistribution: number[];
  
  /** Distribution of commits by hour of day (0-23) */
  timeDistribution: Record<string, number>;
  
  /** Any warnings about the realism of the pattern */
  warnings: string[];
}

/**
 * User preferences that can be saved between sessions
 */
export interface UserPreferences {
  /** Default pattern to use */
  pattern?: CommitPatternType;
  
  /** Default commit count */
  commitCount?: number;
  
  /** Default commit frequency */
  commitFrequency?: number;
  
  /** Default repository path */
  repoPath?: string;
  
  /** Default remote branch */
  remoteBranch?: string;
  
  /** Whether to push to remote by default */
  pushToRemote?: boolean;
  
  /** Default active days */
  activeDays?: number[];
  
  /** Default time of day preference */
  timeOfDay?: TimeOfDayPreference;
  
  /** Default vacation simulation setting */
  simulateVacations?: boolean;
  
  /** Default holiday respect setting */
  respectHolidays?: boolean;
  
  /** Default realism validation setting */
  validateRealism?: boolean;
  
  /** Saved tokens for GitHub API */
  githubToken?: string;
  
  /** User interface preferences */
  ui?: {
    /** Whether to use advanced mode by default */
    advancedMode?: boolean;
    
    /** Whether to show analytics by default */
    showAnalytics?: boolean;
    
    /** Color theme */
    colorTheme?: 'light' | 'dark' | 'system';
  };
} 