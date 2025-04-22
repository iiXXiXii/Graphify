import { DateTime } from 'luxon';
import { GraphifyConfig } from '../config/default';
import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import { ErrorHandler, ErrorLevel } from './errorHandler';

/**
 * Validation utilities for Graphify to ensure legitimate-looking commit patterns
 */
export class ValidationService {
  /**
   * Validates a date to ensure it's not in the future
   * @param date Date to validate
   * @returns True if date is valid (not in future)
   */
  static isValidDate(date: string): boolean {
    const parsedDate = DateTime.fromISO(date);
    const now = DateTime.now();
    
    // Check if date is valid
    if (!parsedDate.isValid) {
      return false;
    }
    
    // Check if date is in the future
    if (parsedDate > now) {
      return false;
    }
    
    return true;
  }

  /**
   * Validates the entire configuration for potential issues
   * @param config Configuration to validate
   * @returns Object containing validation results and messages
   */
  static validateConfig(config: GraphifyConfig): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    // Check start and end dates
    if (config.startDate) {
      const start = DateTime.fromISO(config.startDate);
      if (!start.isValid) {
        errors.push(`Invalid startDate: ${config.startDate}`);
      } else if (start > DateTime.now()) {
        errors.push(`startDate cannot be in the future: ${config.startDate}`);
      }
    }
    
    if (config.endDate) {
      const end = DateTime.fromISO(config.endDate);
      if (!end.isValid) {
        errors.push(`Invalid endDate: ${config.endDate}`);
      } else if (end > DateTime.now()) {
        errors.push(`endDate cannot be in the future: ${config.endDate}`);
      }
    }
    
    // Check if start date is before end date
    if (config.startDate && config.endDate) {
      const start = DateTime.fromISO(config.startDate);
      const end = DateTime.fromISO(config.endDate);
      if (start.isValid && end.isValid && start > end) {
        errors.push(`startDate (${config.startDate}) must be before endDate (${config.endDate})`);
      }
    }
    
    // Check commit count for realism
    if (config.commitCount > 1000) {
      warnings.push(`High commit count (${config.commitCount}) may appear suspicious. Consider fewer commits for more realism.`);
    }
    
    // Check commit frequency for realism
    if (config.commitFrequency && config.commitFrequency > 8) {
      warnings.push(`High commit frequency (${config.commitFrequency}) may appear suspicious. Most developers commit 1-6 times per day.`);
    }
    
    // Check if active days are valid
    if (config.activeDays) {
      const invalidDays = config.activeDays.filter(day => day < 0 || day > 6);
      if (invalidDays.length > 0) {
        errors.push(`Invalid active days: ${invalidDays.join(', ')}. Days must be between 0 (Sunday) and 6 (Saturday).`);
      }
    }
    
    // Check pattern is valid
    if (config.pattern && !['random', 'gradient', 'snake', 'heart', 'realistic', 'steady', 'crescendo', 'custom'].includes(config.pattern)) {
      errors.push(`Invalid pattern: ${config.pattern}`);
    }

    // Check time of day preference if set
    if (config.timeOfDay && !['morning', 'afternoon', 'evening', 'night', 'random', 'working-hours', 'after-hours'].includes(config.timeOfDay)) {
      errors.push(`Invalid timeOfDay: ${config.timeOfDay}`);
    }

    // Check project lifecycle if set
    if (config.projectLifecycleSimulation && !['startup', 'maintenance', 'active-development', 'none'].includes(config.projectLifecycleSimulation)) {
      errors.push(`Invalid projectLifecycleSimulation: ${config.projectLifecycleSimulation}`);
    }

    // Check min time between commits
    if (config.minTimeBetweenCommits !== undefined && (config.minTimeBetweenCommits < 0 || config.minTimeBetweenCommits > 1440)) {
      errors.push(`Invalid minTimeBetweenCommits: ${config.minTimeBetweenCommits}. Should be between 0 and 1440 minutes (24 hours).`);
    }

    // Check vacation count and length if enabled
    if (config.simulateVacations) {
      if (config.vacationCount !== undefined && (config.vacationCount < 0 || config.vacationCount > 10)) {
        warnings.push(`Unusual vacationCount: ${config.vacationCount}. Recommended range is 1-10.`);
      }
      
      if (config.maxVacationLength !== undefined && (config.maxVacationLength < 1 || config.maxVacationLength > 30)) {
        warnings.push(`Unusual maxVacationLength: ${config.maxVacationLength}. Recommended range is 1-30 days.`);
      }
    }

    // Check if data file path is valid
    if (config.dataFilePath) {
      try {
        const dirPath = path.dirname(config.dataFilePath);
        if (!fs.existsSync(dirPath)) {
          warnings.push(`Directory for dataFilePath (${dirPath}) does not exist. It will be created when needed.`);
        }
      } catch (error) {
        errors.push(`Invalid dataFilePath: ${config.dataFilePath}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Validates a date distribution for realism
   * @param dates Array of dates to analyze
   * @returns Object with analysis results
   */
  static analyzeDateDistribution(dates: string[]): {
    hasIssues: boolean;
    suggestions: string[];
    analytics: Record<string, any>;
  } {
    const suggestions: string[] = [];
    const analytics: Record<string, any> = {};
    
    // Convert all dates to DateTime objects
    const dateTimes = dates
      .map(date => DateTime.fromISO(date))
      .filter(dt => dt.isValid);
    
    // Count commits per day
    const commitsPerDay = new Map<string, number>();
    
    dateTimes.forEach(dt => {
      const dayKey = dt.toISODate() || '';
      commitsPerDay.set(dayKey, (commitsPerDay.get(dayKey) || 0) + 1);
    });
    
    // Find days with excessive commits
    const excessiveDays: string[] = [];
    
    commitsPerDay.forEach((count, day) => {
      if (count > 15) { // Most developers don't make more than 15 commits per day
        excessiveDays.push(`${day} (${count} commits)`);
      }
    });
    
    if (excessiveDays.length > 0) {
      suggestions.push(`Some days have unusually high commit counts: ${excessiveDays.join(', ')}`);
    }
    
    // Check distribution across weekdays
    const weekdayCounts = Array(7).fill(0);
    
    dateTimes.forEach(dt => {
      weekdayCounts[dt.weekday % 7]++;
    });
    
    // Check if all commits are on weekends or all on weekdays
    const weekdayTotal = weekdayCounts[1] + weekdayCounts[2] + weekdayCounts[3] + weekdayCounts[4] + weekdayCounts[5];
    const weekendTotal = weekdayCounts[0] + weekdayCounts[6];
    
    if (weekdayTotal === 0 && weekendTotal > 0) {
      suggestions.push('All commits are on weekends. Consider adding some weekday commits for realism.');
    } else if (weekendTotal === 0 && weekdayTotal > 0 && dateTimes.length > 10) {
      suggestions.push('All commits are on weekdays. Consider adding some weekend commits for realism.');
    }
    
    // Check time distribution if we have time information
    const timeHours = new Map<number, number>();
    
    dateTimes.forEach(dt => {
      const hour = dt.hour;
      timeHours.set(hour, (timeHours.get(hour) || 0) + 1);
    });
    
    // Check if all commits are at the same hour
    if (timeHours.size === 1 && dateTimes.length > 5) {
      const hour = Array.from(timeHours.keys())[0];
      suggestions.push(`All commits are at the same hour (${hour}:00). Consider varying commit times for realism.`);
    }

    // Check commit bursts - consecutive commits with minimal time difference
    let consecutiveCommits = 0;
    const sortedDates = [...dateTimes].sort((a, b) => a.toMillis() - b.toMillis());
    
    if (sortedDates.length > 1) {
      for (let i = 1; i < sortedDates.length; i++) {
        const timeDiff = sortedDates[i].diff(sortedDates[i-1], 'minutes').minutes;
        if (timeDiff < 2) { // Less than 2 minutes between commits
          consecutiveCommits++;
        }
      }
      
      if (consecutiveCommits > Math.min(5, dateTimes.length * 0.1)) {
        suggestions.push(`Found ${consecutiveCommits} commits with less than 2 minutes between them. This may look suspicious.`);
      }
    }

    // Add analytics data
    analytics.totalCommits = dateTimes.length;
    analytics.commitsPerDay = Object.fromEntries(commitsPerDay);
    analytics.weekdayDistribution = weekdayCounts;
    analytics.hourDistribution = Object.fromEntries(timeHours);
    analytics.consecutiveCommits = consecutiveCommits;
    
    // Add week-by-week statistics if we have enough data
    if (dateTimes.length > 10) {
      const startDate = sortedDates[0];
      const endDate = sortedDates[sortedDates.length - 1];
      const weeks = Math.ceil(endDate.diff(startDate, 'weeks').weeks);
      
      const weeklyCommits: number[] = Array(weeks + 1).fill(0);
      
      sortedDates.forEach(date => {
        const weekIndex = Math.floor(date.diff(startDate, 'weeks').weeks);
        if (weekIndex >= 0 && weekIndex < weeklyCommits.length) {
          weeklyCommits[weekIndex]++;
        }
      });
      
      analytics.weeklyDistribution = weeklyCommits;
    }
    
    return {
      hasIssues: suggestions.length > 0,
      suggestions,
      analytics,
    };
  }

  /**
   * Validates a Git repository
   * @param repoPath Path to the repository
   * @returns Object with validation results
   */
  static async validateRepository(repoPath: string): Promise<{
    valid: boolean;
    errors: string[];
    info: {
      isRepo: boolean;
      hasRemote: boolean;
      currentBranch: string;
      remotes: string[];
    };
  }> {
    const errors: string[] = [];
    const info = {
      isRepo: false,
      hasRemote: false,
      currentBranch: '',
      remotes: [] as string[]
    };
    
    try {
      // Check if path exists
      if (!fs.existsSync(repoPath)) {
        errors.push(`Repository path does not exist: ${repoPath}`);
        return { valid: false, errors, info };
      }
      
      // Initialize Git
      const git = simpleGit(repoPath);
      
      // Check if it's a Git repository
      info.isRepo = await git.checkIsRepo();
      
      if (!info.isRepo) {
        errors.push(`Path is not a Git repository: ${repoPath}`);
        return { valid: false, errors, info };
      }
      
      // Get current branch
      try {
        const branchSummary = await git.branch();
        info.currentBranch = branchSummary.current;
      } catch (error) {
        errors.push(`Failed to get current branch: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Check remotes
      try {
        const remotes = await git.getRemotes(true);
        info.hasRemote = remotes.length > 0;
        info.remotes = remotes.map(r => `${r.name} (${r.refs.fetch})`);
      } catch (error) {
        errors.push(`Failed to get remotes: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      return {
        valid: errors.length === 0,
        errors,
        info
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to validate repository: ${errorMessage}`);
      ErrorHandler.handle(error, 'Repository Validation', ErrorLevel.ERROR);
      
      return {
        valid: false,
        errors,
        info
      };
    }
  }
} 