import { GraphifyConfig } from './config/default';
import { GitService } from './utils/git';
import { FileManager } from './utils/fileManager';
import { getRandomInt, getRandomDate } from './utils/random';
import { generateCommitDate, getCurrentDate, parseDate } from './utils/date';
import { DateTime } from 'luxon';
import { ValidationService } from './utils/validation';
import { TimeUtils } from './utils/timeUtils';
import { CommitMessageGenerator } from './utils/commitMessages';

interface CommitPlan {
  date: string;
  count: number;
}

interface CommitAnalytics {
  pattern: string;
  totalCommits: number;
  dateDistribution: Record<string, number>;
  weekdayDistribution: number[];
  timeDistribution: Record<string, number>;
  warnings: string[];
}

/**
 * Main Graphify class to generate GitHub contribution graph
 */
export class Graphify {
  private config: GraphifyConfig;
  private gitService: GitService;
  private commitPlan: CommitPlan[] = [];
  private commitDates: string[] = [];
  private vacationPeriods: Array<[DateTime, DateTime]> = [];
  private analytics: CommitAnalytics | null = null;
  private lastCommitTime: DateTime | undefined;

  /**
   * Creates a new Graphify instance
   * @param config Graphify configuration
   */
  constructor(config: GraphifyConfig) {
    this.config = config;
    this.gitService = new GitService(config);
    
    // Validate configuration
    this.validateConfig();
  }

  /**
   * Validates the configuration for potential issues
   */
  private validateConfig(): void {
    const validation = ValidationService.validateConfig(this.config);
    
    if (!validation.valid) {
      console.error('❌ Invalid configuration:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('Invalid configuration. Please check the errors above.');
    }
    
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Configuration warnings:');
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
  }

  /**
   * Generate analytics for the commit plan
   * @returns Commit analytics
   */
  private generateAnalytics(): CommitAnalytics {
    // Create date distribution map
    const dateDistribution: Record<string, number> = {};
    const weekdayDistribution = Array(7).fill(0);
    const timeDistribution: Record<string, number> = {};
    
    // Fill distribution data
    this.commitDates.forEach(dateStr => {
      const date = parseDate(dateStr);
      const dateKey = date.toISODate() || '';
      const hourKey = date.hour.toString();
      
      // Increment date count
      dateDistribution[dateKey] = (dateDistribution[dateKey] || 0) + 1;
      
      // Increment weekday count
      weekdayDistribution[date.weekday % 7]++;
      
      // Increment hour count
      timeDistribution[hourKey] = (timeDistribution[hourKey] || 0) + 1;
    });
    
    // Get distribution analysis
    const analysis = ValidationService.analyzeDateDistribution(this.commitDates);
    
    return {
      pattern: this.config.pattern || 'random',
      totalCommits: this.commitDates.length,
      dateDistribution,
      weekdayDistribution,
      timeDistribution,
      warnings: analysis.suggestions
    };
  }

  /**
   * Generates a commit plan based on the selected pattern
   * @returns Array of planned commits
   */
  private generateCommitPlan(): CommitPlan[] {
    const now = DateTime.now();
    const endDate = this.config.endDate 
      ? parseDate(this.config.endDate) 
      : now;
      
    // Ensure end date is not in the future if preventFutureCommits is enabled
    const safeEndDate = this.config.preventFutureCommits !== false && endDate > now 
      ? now 
      : endDate;
      
    const startDate = this.config.startDate 
      ? parseDate(this.config.startDate)
      : safeEndDate.minus({ days: 365 });
    
    console.log(`Generating commits between ${startDate.toISODate()} and ${safeEndDate.toISODate()}`);
    
    // Generate vacation periods if enabled
    if (this.config.simulateVacations) {
      const vacationCount = this.config.vacationCount || 2;
      const maxVacationLength = this.config.maxVacationLength || 14;
      this.vacationPeriods = TimeUtils.generateVacationPeriods(
        startDate, 
        safeEndDate, 
        vacationCount, 
        maxVacationLength
      );
      
      if (this.vacationPeriods.length > 0) {
        console.log(`Generated ${this.vacationPeriods.length} vacation periods:`);
        this.vacationPeriods.forEach(([start, end]) => {
          console.log(`  - ${start.toISODate()} to ${end.toISODate()}`);
        });
      }
    }

    // Create different patterns
    switch (this.config.pattern) {
      case 'random':
        return this.generateRandomPattern(startDate, safeEndDate);
      case 'gradient':
        return this.generateGradientPattern(startDate, safeEndDate);
      case 'snake':
        return this.generateSnakePattern(startDate, safeEndDate);
      case 'heart':
        return this.generateHeartPattern(startDate, safeEndDate);
      case 'realistic':
        return this.generateRealisticPattern(startDate, safeEndDate);
      case 'steady':
        return this.generateSteadyPattern(startDate, safeEndDate);
      case 'crescendo':
        return this.generateCrescendoPattern(startDate, safeEndDate);
      case 'custom':
        if (this.config.customPattern) {
          return this.generateCustomPattern(startDate, safeEndDate, this.config.customPattern);
        }
        // Fall back to random if no custom pattern provided
        return this.generateRandomPattern(startDate, safeEndDate);
      default:
        return this.generateRandomPattern(startDate, safeEndDate);
    }
  }

  /**
   * Check if a date is valid for commit generation
   * @param date Date to check
   * @returns True if date is valid for commits
   */
  private isValidCommitDate(date: DateTime): boolean {
    // Skip dates in vacation periods
    if (this.config.simulateVacations && TimeUtils.isVacation(date, this.vacationPeriods)) {
      return false;
    }
    
    // Skip holidays if enabled
    if (this.config.respectHolidays && TimeUtils.isHoliday(date, this.config.holidayCountry)) {
      return false;
    }
    
    // Check if active day
    const activeDays = this.config.activeDays || [1, 2, 3, 4, 5]; // Default: Mon-Fri
    if (!activeDays.includes(date.weekday % 7)) {
      return false;
    }
    
    return true;
  }

  /**
   * Generates a random pattern of commits
   */
  private generateRandomPattern(startDate: DateTime, endDate: DateTime): CommitPlan[] {
    const plan: CommitPlan[] = [];
    const totalCommits = this.config.commitCount;
    const frequency = this.config.commitFrequency || 1;
    
    // Create a list of possible dates between start and end
    let currentDate = startDate;
    const possibleDates: DateTime[] = [];
    
    while (currentDate <= endDate) {
      if (this.isValidCommitDate(currentDate)) {
        possibleDates.push(currentDate);
      }
      currentDate = currentDate.plus({ days: 1 });
    }

    // If we have more commits than possible dates, adjust the frequency
    const neededDates = Math.ceil(totalCommits / frequency);
    let adjustedFrequency = frequency;
    
    if (neededDates > possibleDates.length) {
      // We need more days than we have available, adjust frequency
      adjustedFrequency = Math.ceil(totalCommits / possibleDates.length);
      console.log(`Note: Adjusting commit frequency to ${adjustedFrequency} to fit all commits`);
    }

    // Randomly select dates for commits
    const selectedDates = possibleDates
      .sort(() => Math.random() - 0.5) // Shuffle
      .slice(0, Math.min(neededDates, possibleDates.length));

    // Create the plan
    for (const date of selectedDates) {
      plan.push({
        date: date.toISO() || date.toString(),
        count: adjustedFrequency,
      });
    }

    // Adjust the last entry if we have too many commits
    const totalPlannedCommits = plan.reduce((sum, entry) => sum + entry.count, 0);
    if (totalPlannedCommits > totalCommits && plan.length > 0) {
      const lastEntry = plan[plan.length - 1];
      lastEntry.count -= (totalPlannedCommits - totalCommits);
    }

    return plan;
  }

  /**
   * Generates a gradient pattern (more commits in recent dates)
   */
  private generateGradientPattern(startDate: DateTime, endDate: DateTime): CommitPlan[] {
    const plan: CommitPlan[] = [];
    const totalCommits = this.config.commitCount;
    
    // Create a list of possible dates between start and end
    let currentDate = startDate;
    const possibleDates: DateTime[] = [];
    
    while (currentDate <= endDate) {
      if (this.isValidCommitDate(currentDate)) {
        possibleDates.push(currentDate);
      }
      currentDate = currentDate.plus({ days: 1 });
    }

    // Sort by date (older to newer)
    possibleDates.sort((a, b) => a.toMillis() - b.toMillis());

    // Distribute commits with higher concentration on recent dates
    let commitsLeft = totalCommits;
    
    for (let i = 0; i < possibleDates.length && commitsLeft > 0; i++) {
      // Use a gradient formula: more commits for more recent dates
      // The last 20% of dates get 50% of commits
      let commitCount = 1;
      const normalizedPosition = i / possibleDates.length;
      
      if (normalizedPosition > 0.8) {
        // Last 20% of dates get more commits
        commitCount = Math.max(1, Math.floor(commitsLeft * 0.1));
      } else if (normalizedPosition > 0.5) {
        // Middle dates get medium commits
        commitCount = Math.max(1, Math.floor(commitsLeft * 0.05));
      } else {
        // Early dates get fewer commits
        commitCount = Math.max(1, Math.floor(commitsLeft * 0.02));
      }
      
      // Don't assign more commits than we have left
      commitCount = Math.min(commitCount, commitsLeft);
      
      plan.push({
        date: possibleDates[i].toISO() || possibleDates[i].toString(),
        count: commitCount,
      });
      
      commitsLeft -= commitCount;
    }

    return plan;
  }

  /**
   * Generates a snake pattern (zigzag across the contribution graph)
   */
  private generateSnakePattern(startDate: DateTime, endDate: DateTime): CommitPlan[] {
    // First create a random distribution of dates
    const randomPlan = this.generateRandomPattern(startDate, endDate);
    
    // Now arrange them in a snake pattern based on the week number
    randomPlan.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      
      const weekA = Math.floor(dateA.diff(startDate, 'days').days / 7);
      const weekB = Math.floor(dateB.diff(startDate, 'days').days / 7);
      
      // Primary sort by week number
      if (weekA !== weekB) return weekA - weekB;
      
      // Secondary sort: even weeks ascending by day, odd weeks descending
      const dayA = dateA.weekday;
      const dayB = dateB.weekday;
      
      return weekA % 2 === 0 ? dayA - dayB : dayB - dayA;
    });
    
    return randomPlan;
  }

  /**
   * Generates a heart pattern (more commits in the center of the year)
   */
  private generateHeartPattern(startDate: DateTime, endDate: DateTime): CommitPlan[] {
    const plan: CommitPlan[] = [];
    const totalCommits = this.config.commitCount;
    
    // Get possible dates
    let currentDate = startDate;
    const possibleDates: DateTime[] = [];
    
    while (currentDate <= endDate) {
      if (this.isValidCommitDate(currentDate)) {
        possibleDates.push(currentDate);
      }
      currentDate = currentDate.plus({ days: 1 });
    }
    
    // Find the middle of the date range
    const midDate = startDate.plus({ days: endDate.diff(startDate, 'days').days / 2 });
    
    // Sort dates by distance from middle (closest first)
    possibleDates.sort((a, b) => {
      const distA = Math.abs(a.diff(midDate, 'days').days);
      const distB = Math.abs(b.diff(midDate, 'days').days);
      return distA - distB;
    });
    
    // Distribute commits with higher concentration in the middle
    let commitsLeft = totalCommits;
    const totalDates = possibleDates.length;
    
    for (let i = 0; i < totalDates && commitsLeft > 0; i++) {
      // Use a heart-shaped formula: more commits for dates near the middle
      const normalizedDistance = i / totalDates;
      let commitCount = 1;
      
      if (normalizedDistance < 0.2) {
        // Center 20% gets most commits
        commitCount = Math.max(1, Math.floor(commitsLeft * 0.15));
      } else if (normalizedDistance < 0.5) {
        // Next 30% gets medium commits
        commitCount = Math.max(1, Math.floor(commitsLeft * 0.05));
      } else {
        // Outer 50% gets fewer commits
        commitCount = Math.max(1, Math.floor(commitsLeft * 0.01));
      }
      
      // Don't assign more commits than we have left
      commitCount = Math.min(commitCount, commitsLeft);
      
      plan.push({
        date: possibleDates[i].toISO() || possibleDates[i].toString(),
        count: commitCount,
      });
      
      commitsLeft -= commitCount;
    }
    
    return plan;
  }

  /**
   * Generates a realistic pattern simulating typical developer activity
   */
  private generateRealisticPattern(startDate: DateTime, endDate: DateTime): CommitPlan[] {
    const plan: CommitPlan[] = [];
    const totalCommits = this.config.commitCount;
    
    // Get possible dates
    let currentDate = startDate;
    const possibleDates: DateTime[] = [];
    
    while (currentDate <= endDate) {
      if (this.isValidCommitDate(currentDate)) {
        possibleDates.push(currentDate);
      }
      currentDate = currentDate.plus({ days: 1 });
    }
    
    // Sort dates chronologically
    possibleDates.sort((a, b) => a.toMillis() - b.toMillis());
    
    // Development cycle parameters
    const cycleLength = this.config.developmentCycleLength || 14; // 2-week sprints by default
    const cycleStart = possibleDates[0];
    
    // Project lifecycle parameters
    const projectLifecycle = this.config.projectLifecycleSimulation || 'none';
    
    // Distribute commits
    let commitsLeft = totalCommits;
    
    for (let i = 0; i < possibleDates.length && commitsLeft > 0; i++) {
      const date = possibleDates[i];
      let commitWeight = 1.0;
      
      // Apply development cycle weight if enabled
      if (this.config.simulateDevelopmentCycles) {
        commitWeight *= TimeUtils.getDevelopmentCycleWeight(date, cycleStart, cycleLength);
      }
      
      // Apply project lifecycle weight
      if (projectLifecycle !== 'none') {
        const projectProgress = i / possibleDates.length; // 0 to 1
        
        switch (projectLifecycle) {
          case 'startup':
            // More commits at the beginning
            commitWeight *= 1.5 - projectProgress;
            break;
          case 'maintenance':
            // Fewer commits overall, occasional spikes
            commitWeight *= 0.5 + (Math.sin(projectProgress * 10) * 0.25);
            break;
          case 'active-development':
            // Consistent high activity with occasional peaks
            commitWeight *= 0.8 + (Math.sin(projectProgress * 5) * 0.4);
            break;
        }
      }
      
      // Calculate commits for this day
      let commitCount = Math.max(1, Math.round(commitWeight * (this.config.commitFrequency || 1)));
      
      // Ensure we don't exceed remaining commits
      commitCount = Math.min(commitCount, commitsLeft);
      
      // Add to plan
      if (commitCount > 0) {
        plan.push({
          date: date.toISO() || date.toString(),
          count: commitCount,
        });
        
        commitsLeft -= commitCount;
      }
    }
    
    // If we have commits left, distribute them evenly across the plan
    if (commitsLeft > 0 && plan.length > 0) {
      const commitPerDay = Math.ceil(commitsLeft / plan.length);
      
      for (let i = 0; i < plan.length && commitsLeft > 0; i++) {
        const addCount = Math.min(commitPerDay, commitsLeft);
        plan[i].count += addCount;
        commitsLeft -= addCount;
      }
    }
    
    return plan;
  }

  /**
   * Generates a steady pattern with consistent commit frequency
   */
  private generateSteadyPattern(startDate: DateTime, endDate: DateTime): CommitPlan[] {
    const plan: CommitPlan[] = [];
    const totalCommits = this.config.commitCount;
    
    // Get possible dates
    let currentDate = startDate;
    const possibleDates: DateTime[] = [];
    
    while (currentDate <= endDate) {
      if (this.isValidCommitDate(currentDate)) {
        possibleDates.push(currentDate);
      }
      currentDate = currentDate.plus({ days: 1 });
    }
    
    // Sort dates chronologically
    possibleDates.sort((a, b) => a.toMillis() - b.toMillis());
    
    // Calculate average commits per day
    const commitsPerDay = Math.max(1, Math.floor(totalCommits / possibleDates.length));
    let remainingCommits = totalCommits - (commitsPerDay * possibleDates.length);
    
    // Distribute commits evenly with slight random variation
    for (const date of possibleDates) {
      // Calculate base commit count with small random variance
      let variance = 0;
      if (commitsPerDay > 1) {
        variance = getRandomInt(-Math.floor(commitsPerDay * 0.2), Math.ceil(commitsPerDay * 0.2));
      }
      
      let commitCount = Math.max(1, commitsPerDay + variance);
      
      // Add an extra commit to some days to distribute remaining commits
      if (remainingCommits > 0) {
        commitCount += 1;
        remainingCommits -= 1;
      }
      
      plan.push({
        date: date.toISO() || date.toString(),
        count: commitCount,
      });
    }
    
    return plan;
  }

  /**
   * Generates a crescendo pattern (gradually increasing activity)
   */
  private generateCrescendoPattern(startDate: DateTime, endDate: DateTime): CommitPlan[] {
    const plan: CommitPlan[] = [];
    const totalCommits = this.config.commitCount;
    
    // Get possible dates
    let currentDate = startDate;
    const possibleDates: DateTime[] = [];
    
    while (currentDate <= endDate) {
      if (this.isValidCommitDate(currentDate)) {
        possibleDates.push(currentDate);
      }
      currentDate = currentDate.plus({ days: 1 });
    }
    
    // Sort dates chronologically
    possibleDates.sort((a, b) => a.toMillis() - b.toMillis());
    
    // Distribute commits with gradually increasing frequency
    let commitsLeft = totalCommits;
    const totalDays = possibleDates.length;
    
    for (let i = 0; i < totalDays && commitsLeft > 0; i++) {
      // Calculate growth factor (from 0.2 at start to 2.0 at end)
      const growthFactor = 0.2 + (i / totalDays) * 1.8;
      
      // Calculate base commit count
      let commitCount = Math.max(1, Math.round(growthFactor * (this.config.commitFrequency || 1)));
      
      // Don't assign more commits than we have left
      commitCount = Math.min(commitCount, commitsLeft);
      
      plan.push({
        date: possibleDates[i].toISO() || possibleDates[i].toString(),
        count: commitCount,
      });
      
      commitsLeft -= commitCount;
    }
    
    return plan;
  }

  /**
   * Generates a custom pattern based on provided data
   */
  private generateCustomPattern(startDate: DateTime, endDate: DateTime, customPattern: number[][]): CommitPlan[] {
    // For now, just generate a random pattern
    console.log('Custom pattern not fully implemented yet, using random pattern');
    return this.generateRandomPattern(startDate, endDate);
  }

  /**
   * Generates a single commit with a specific date
   * @param date Date for the commit
   * @returns Promise resolving with the generated date
   */
  private async generateSingleCommit(date: string): Promise<string> {
    // Apply time variance if enabled
    let finalDate = date;
    
    if (this.config.useRealisticTimestamps) {
      const baseDate = parseDate(date);
      
      if (baseDate.isValid) {
        // Apply realistic timestamp with minimum time between commits
        const timePreference = this.config.timeOfDay || 'working-hours';
        const minTimeBetween = this.config.minTimeBetweenCommits || 30;
        
        const dateWithTime = TimeUtils.applyTimeVariance(
          baseDate,
          timePreference,
          minTimeBetween,
          this.lastCommitTime
        );
        
        finalDate = dateWithTime.toISO() || date;
        this.lastCommitTime = dateWithTime;
      }
    }
    
    // Record date for analytics
    this.commitDates.push(finalDate);
    
    // Generate data
    const data = { date: finalDate };
    
    // Generate commit message
    let commitMessage = finalDate; // Default to using the date as the message
    
    if (this.config.commitMessages && this.config.commitMessages.length > 0) {
      // Use custom template
      commitMessage = CommitMessageGenerator.generateFromTemplates(this.config.commitMessages);
    } else {
      // Generate realistic message
      commitMessage = CommitMessageGenerator.generateMessage();
    }
    
    try {
      await FileManager.writeJsonFile(this.config.dataFilePath, data);
      await this.gitService.commitAndPush([this.config.dataFilePath], commitMessage, finalDate);
      return finalDate;
    } catch (error) {
      console.error('Error generating commit:', error);
      throw error;
    }
  }

  /**
   * Runs the Graphify process to generate commits
   * @param count Number of commits to generate (defaults to config value)
   * @returns Promise resolving when all commits are generated
   */
  async run(count: number = this.config.commitCount): Promise<void> {
    console.log(`Starting Graphify with ${count} commits`);
    
    // Generate the commit plan
    this.commitPlan = this.generateCommitPlan();
    
    // Display the plan summary
    console.log(`Generated plan with ${this.commitPlan.length} dates and ${this.commitPlan.reduce((sum, plan) => sum + plan.count, 0)} commits`);
    
    // Initialize Git service
    try {
      await this.gitService.initialize();
    } catch (error) {
      console.error('Failed to initialize Git repository:', error);
      throw error;
    }
    
    // Execute the plan
    let completedCommits = 0;
    const totalCommits = this.commitPlan.reduce((sum, plan) => sum + plan.count, 0);
    
    console.log('Starting commit generation...');
    console.log('----------------------------------------------------------------');
    
    for (const plan of this.commitPlan) {
      for (let i = 0; i < plan.count; i++) {
        try {
          const commitDate = await this.generateSingleCommit(plan.date);
          completedCommits++;
          
          // Show progress every 10 commits or when complete
          if (completedCommits % 10 === 0 || completedCommits === totalCommits) {
            const percentage = Math.floor((completedCommits / totalCommits) * 100);
            console.log(`Progress: ${completedCommits}/${totalCommits} commits (${percentage}%)`);
          }
        } catch (error) {
          console.error(`Failed to generate commit for ${plan.date}:`, error);
          // Continue with the next commit rather than aborting the whole process
        }
      }
    }
    
    console.log('----------------------------------------------------------------');
    console.log(`Completed ${completedCommits}/${totalCommits} commits`);
    
    // Generate analytics
    if (this.config.showAnalytics) {
      this.analytics = this.generateAnalytics();
    }
  }

  /**
   * Finalizes the process by making a final commit with the current date
   * @returns Promise resolving when the final commit is made
   */
  async finalize(): Promise<void> {
    const date = getCurrentDate();
    const data: Record<string, any> = { 
      date, 
      completed: true,
      totalCommits: this.commitDates.length,
      pattern: this.config.pattern || 'random',
      generatedBy: 'Graphify'
    };
    
    // Add analytics if available
    if (this.analytics) {
      data.analytics = this.analytics;
    }
    
    try {
      await FileManager.writeJsonFile(this.config.dataFilePath, data);
      await this.gitService.commitAndPush(
        [this.config.dataFilePath], 
        'Finalize Graphify contribution graph', 
        date
      );
      
      // Show analytics summary if enabled
      if (this.analytics) {
        console.log('\nCommit Distribution Analytics:');
        console.log('----------------------------------------------------------------');
        console.log(`Pattern: ${this.analytics.pattern}`);
        console.log(`Total commits: ${this.analytics.totalCommits}`);
        
        // Weekday distribution
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        console.log(`Weekday distribution:`);
        
        for (let i = 0; i < 7; i++) {
          const percentage = Math.round((this.analytics.weekdayDistribution[i] / this.analytics.totalCommits) * 100);
          console.log(`  - ${days[i]}: ${this.analytics.weekdayDistribution[i]} commits (${percentage}%)`);
        }
        
        // Warnings
        if (this.analytics.warnings.length > 0) {
          console.log('\nDistribution analysis warnings:');
          this.analytics.warnings.forEach(warning => {
            console.log(`  - ${warning}`);
          });
        }
        
        console.log('----------------------------------------------------------------');
      }
      
      console.log('Graphify process finalized!');
    } catch (error) {
      console.error('Error finalizing Graphify:', error);
      throw error;
    }
  }
} 