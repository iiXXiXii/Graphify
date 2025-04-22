import { DateTime } from 'luxon';
import ora from 'ora';
import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs';
import { UIComponents } from '../../ui/formatters/components';
import { ThemeManager } from '../../ui/themes/theme';
import { ErrorCategory, ErrorHandler, GraphifyError } from '../../utils/errorHandler';
import { GraphifyConfig } from '../../types/config';
import { getErrorHandler } from '../../utils/errorHandler';
import { generateRandomDate, isWeekend, isHoliday } from '../../utils/date';
import { getTimeOfDayRange } from '../../utils/timeUtils';
import * as os from 'os';

/**
 * CommitData represents a single commit to be created
 */
interface CommitData {
  date: DateTime;
  message: string;
  index: number;
}

/**
 * Pattern data structure
 */
interface PatternData {
  dates: DateTime[];
  messages: string[];
}

/**
 * Configuration for commit generation
 */
interface CommitGenerationConfig {
  repoPath: string;
  batchSize: number;
  progressCallback?: (current: number, total: number) => void;
  pushToRemote: boolean;
  remoteBranch?: string;
}

/**
 * Performance metrics for pattern generation
 */
interface PerformanceMetrics {
  generationTimeMs: number;
  memoryUsageMb: number;
  cpuIntensive: boolean;
  optimizationLevel: string;
  optimizationApplied: string[];
}

/**
 * Commit date generation result
 */
interface DateGenerationResult {
  dates: DateTime[];
  metrics: PerformanceMetrics;
}

/**
 * A performance-optimized commit generator that uses batched processing
 * to improve efficiency and responsiveness
 */
export class OptimizedCommitGenerator {
  private git: SimpleGit;
  private ui: UIComponents;
  private theme: ThemeManager;
  private errorHandler: ErrorHandler;

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath);
    this.ui = new UIComponents();
    this.theme = ThemeManager.getInstance();
    this.errorHandler = new ErrorHandler();
  }

  /**
   * Generate commits based on the pattern data
   * @param pattern The pattern data with dates and messages
   * @param config The configuration options
   * @returns A promise that resolves when all commits are generated
   */
  async generateCommits(pattern: PatternData, config: CommitGenerationConfig): Promise<void> {
    const { repoPath, batchSize = 10, progressCallback, pushToRemote, remoteBranch = 'main' } = config;

    if (!fs.existsSync(repoPath)) {
      throw {
        message: `Repository path does not exist: ${repoPath}`,
        category: ErrorCategory.Git,
      } as GraphifyError;
    }

    try {
      // Prepare data for processing
      const commits: CommitData[] = pattern.dates.map((date, index) => ({
        date,
        message: pattern.messages[index],
        index,
      }));

      // Sort by date to ensure chronological order
      commits.sort((a, b) => a.date.toMillis() - b.date.toMillis());

      const totalCommits = commits.length;
      let processedCommits = 0;

      // Process commits in batches
      const spinner = ora('Generating commit history').start();

      // Divide commits into batches
      for (let i = 0; i < commits.length; i += batchSize) {
        const batch = commits.slice(i, i + batchSize);
        await this.processBatch(batch, repoPath);

        // Update progress
        processedCommits += batch.length;
        if (progressCallback) {
          progressCallback(processedCommits, totalCommits);
        }

        spinner.text = `Processed ${processedCommits} of ${totalCommits} commits`;
      }

      spinner.succeed(`Successfully generated ${totalCommits} commits`);

      // Push to remote if requested
      if (pushToRemote) {
        spinner.start('Pushing commits to remote repository');
        await this.git.push('origin', remoteBranch);
        spinner.succeed('Pushed commits to remote repository');
      }
    } catch (error) {
      this.errorHandler.handleError(error as GraphifyError);
    }
  }

  /**
   * Process a batch of commits
   * @param batch The batch of commits to process
   * @param repoPath The repository path
   */
  private async processBatch(batch: CommitData[], repoPath: string): Promise<void> {
    const tempFile = path.join(repoPath, '.graphify-temp');

    for (const commit of batch) {
      // Create a temporary file change for the commit
      fs.writeFileSync(tempFile, `Graphify commit ${commit.index} - ${commit.date.toISO()}`);

      // Stage the file
      await this.git.add(tempFile);

      // Set the commit date and create the commit
      const env = {
        GIT_AUTHOR_DATE: commit.date.toISO(),
        GIT_COMMITTER_DATE: commit.date.toISO()
      };

      await this.git.env(env).commit(commit.message);
    }

    // Clean up temp file after batch completion
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }

  /**
   * Validate the repository state before starting commit generation
   * @param repoPath Path to the repository
   */
  async validateRepository(repoPath: string): Promise<boolean> {
    try {
      // Check if path is a git repository
      await this.git.checkIsRepo();

      // Check for uncommitted changes
      const status = await this.git.status();
      if (status.files.length > 0) {
        this.ui.warning(
          'The repository has uncommitted changes. These may interfere with the commit generation process.',
          this.theme.current.warningColor
        );
        return false;
      }

      return true;
    } catch (error) {
      this.errorHandler.handleError({
        message: 'Invalid git repository or repository access error',
        category: ErrorCategory.Git,
        original: error
      });
      return false;
    }
  }

  /**
   * Create a commit pattern preview
   * @param pattern The pattern data
   * @returns A 2D array representing the pattern (days x weeks)
   */
  createPatternPreview(pattern: PatternData): number[][] {
    // Group commits by week and day of week
    const weekMap = new Map<number, Map<number, number>>();

    for (const date of pattern.dates) {
      const weekOfYear = date.weekNumber;
      const dayOfWeek = date.weekday % 7; // 0 = Sunday, 6 = Saturday

      if (!weekMap.has(weekOfYear)) {
        weekMap.set(weekOfYear, new Map<number, number>());
      }

      const weekData = weekMap.get(weekOfYear)!;
      weekData.set(dayOfWeek, (weekData.get(dayOfWeek) || 0) + 1);
    }

    // Convert to 2D array for visualization
    // Each inner array represents a week
    const result: number[][] = [];

    const weeks = Array.from(weekMap.keys()).sort((a, b) => a - b);
    for (const week of weeks) {
      const weekData = weekMap.get(week)!;
      const weekArray: number[] = Array(7).fill(0);

      for (let i = 0; i < 7; i++) {
        weekArray[i] = weekData.get(i) || 0;
      }

      result.push(weekArray);
    }

    return result;
  }

  /**
   * Get analytics data from the generated pattern
   * @param pattern The pattern data
   * @returns Analytics data
   */
  getAnalytics(pattern: PatternData): Record<string, any> {
    const totalCommits = pattern.dates.length;

    // Date distribution
    const dateDistribution: Record<string, number> = {};
    for (const date of pattern.dates) {
      const dateStr = date.toISODate();
      if (dateStr) {
        dateDistribution[dateStr] = (dateDistribution[dateStr] || 0) + 1;
      }
    }

    // Weekday distribution
    const weekdayDistribution = Array(7).fill(0);
    for (const date of pattern.dates) {
      const dayOfWeek = date.weekday % 7; // 0 = Sunday, 6 = Saturday
      weekdayDistribution[dayOfWeek]++;
    }

    // Hour distribution
    const hourDistribution: Record<string, number> = {};
    for (const date of pattern.dates) {
      const hour = date.hour;
      hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
    }

    // Month distribution
    const monthDistribution: Record<string, number> = {};
    for (const date of pattern.dates) {
      const month = date.monthLong;
      monthDistribution[month] = (monthDistribution[month] || 0) + 1;
    }

    return {
      totalCommits,
      dateDistribution,
      weekdayDistribution,
      hourDistribution,
      monthDistribution,

      // Add some insights
      insights: {
        mostActiveDay: Object.entries(weekdayDistribution)
          .reduce((max, [day, count]) => count > max[1] ? [day, count] : max, ['0', 0])[0],
        mostActiveHour: Object.entries(hourDistribution)
          .reduce((max, [hour, count]) => count > max[1] ? [hour, count] : max, ['0', 0])[0],
        mostActiveMonth: Object.entries(monthDistribution)
          .reduce((max, [month, count]) => count > max[1] ? [month, count] : max, ['', 0])[0],
        averageCommitsPerActiveDay: totalCommits / Object.keys(dateDistribution).length,
      }
    };
  }
}

/**
 * OptimizedPatternGenerator provides methods for generating commit patterns
 * with adaptive performance optimizations based on system resources
 */
export class OptimizedPatternGenerator {
  private config: GraphifyConfig;
  private memoryThresholdMb = 512; // Memory threshold for optimizations
  private batchSize = 100; // Batch size for large generation
  private readonly maxMemoryPercent = 75; // Max percent of system memory to use
  private errorHandler = getErrorHandler();

  /**
   * Create a new OptimizedPatternGenerator
   * @param config The configuration to use
   */
  constructor(config: GraphifyConfig) {
    this.config = config;
    this.adaptToSystemResources();
  }

  /**
   * Adapt optimization settings to available system resources
   */
  private adaptToSystemResources(): void {
    // Get available system memory
    const totalMemoryMb = Math.floor(os.totalmem() / (1024 * 1024));
    const availableMemoryMb = Math.floor(os.freemem() / (1024 * 1024));

    // Calculate safe memory usage (don't use more than x% of total)
    const safeMemoryUsageMb = totalMemoryMb * (this.maxMemoryPercent / 100);

    // Adapt memory threshold
    this.memoryThresholdMb = Math.min(512, safeMemoryUsageMb / 4);

    // Adjust batch size based on available memory
    if (availableMemoryMb < 1024) {
      // Low memory mode
      this.batchSize = 50;
    } else if (availableMemoryMb > 4096) {
      // High memory mode
      this.batchSize = 500;
    }

    // Get CPU cores count
    const cpuCount = os.cpus().length;

    // If multiple cores available, increase batch size
    if (cpuCount > 4) {
      this.batchSize = Math.floor(this.batchSize * 1.5);
    }
  }

  /**
   * Generate commit dates based on the configured pattern
   * @param pattern Pattern to generate
   * @returns Array of DateTime objects representing commit dates
   */
  public async generateDates(pattern: string = this.config.pattern): Promise<DateGenerationResult> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed / (1024 * 1024);
    const optimizationsApplied: string[] = [];

    let dates: DateTime[];
    let cpuIntensive = false;
    let optimizationLevel = 'none';

    try {
      // High commit count requires optimization
      if (this.config.commitCount > 1000) {
        optimizationsApplied.push('batch-processing');
        optimizationLevel = 'high';
        dates = await this.generateBatchedPattern(pattern);
        cpuIntensive = true;
      }
      // For medium-sized generation
      else if (this.config.commitCount > 200) {
        optimizationsApplied.push('time-distribution-cache');
        optimizationLevel = 'medium';
        dates = this.generateMediumPattern(pattern);
      }
      // For small-sized generation
      else {
        optimizationLevel = 'minimal';
        dates = this.generateStandardPattern(pattern);
      }

      // Apply post-processing optimizations
      if (this.config.respectHolidays || this.shouldFilterWeekends()) {
        optimizationsApplied.push('filter-optimization');
        dates = this.applyDateFilters(dates);
      }

      // Validate and apply time constraints
      if (this.config.useRealisticTimestamps) {
        optimizationsApplied.push('time-constraint-optimization');
        dates = this.applyTimeConstraints(dates);
      }

    } catch (error) {
      this.errorHandler.handleError(error);
      // Fallback to the simplest algorithm
      console.warn('Falling back to simplified algorithm due to error');
      optimizationsApplied.push('error-fallback');
      optimizationLevel = 'fallback';
      dates = this.generateSimplifiedPattern();
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed / (1024 * 1024);

    const metrics: PerformanceMetrics = {
      generationTimeMs: Math.round(endTime - startTime),
      memoryUsageMb: Math.round((endMemory - startMemory) * 100) / 100,
      cpuIntensive,
      optimizationLevel,
      optimizationApplied: optimizationsApplied
    };

    return { dates, metrics };
  }

  /**
   * Generate pattern in batches for large commit counts
   * @param pattern The pattern to generate
   * @returns Array of DateTime objects
   */
  private async generateBatchedPattern(pattern: string): Promise<DateTime[]> {
    const allDates: DateTime[] = [];
    const batchCount = Math.ceil(this.config.commitCount / this.batchSize);

    for (let i = 0; i < batchCount; i++) {
      const batchCommitCount = Math.min(
        this.batchSize,
        this.config.commitCount - (i * this.batchSize)
      );

      // Create a temporary config with reduced commit count
      const batchConfig = {
        ...this.config,
        commitCount: batchCommitCount
      };

      // Process batch
      const tempGenerator = new OptimizedPatternGenerator(batchConfig);
      const batchDates = tempGenerator.generateStandardPattern(pattern);

      allDates.push(...batchDates);

      // Check memory usage and trigger GC if needed
      const currentMemoryMb = process.memoryUsage().heapUsed / (1024 * 1024);
      if (currentMemoryMb > this.memoryThresholdMb) {
        // Allow garbage collection before next batch
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    return allDates;
  }

  /**
   * Generate pattern using standard algorithm
   * @param pattern The pattern to generate
   * @returns Array of DateTime objects
   */
  private generateStandardPattern(pattern: string): DateTime[] {
    const dates: DateTime[] = [];
    const startDate = DateTime.fromISO(this.config.startDate);
    const endDate = DateTime.fromISO(this.config.endDate);

    switch (pattern) {
      case 'random':
        return this.generateRandomPattern(startDate, endDate);
      case 'gradient':
        return this.generateGradientPattern(startDate, endDate);
      case 'snake':
        return this.generateSnakePattern(startDate, endDate);
      case 'heart':
        return this.generateHeartPattern(startDate, endDate);
      case 'realistic':
        return this.generateRealisticPattern(startDate, endDate);
      case 'steady':
        return this.generateSteadyPattern(startDate, endDate);
      case 'crescendo':
        return this.generateCrescendoPattern(startDate, endDate);
      case 'custom':
        return this.generateCustomPattern(startDate, endDate);
      default:
        return this.generateRandomPattern(startDate, endDate);
    }
  }

  /**
   * Generate pattern with medium optimizations
   * @param pattern The pattern to generate
   * @returns Array of DateTime objects
   */
  private generateMediumPattern(pattern: string): DateTime[] {
    // For medium optimizations, we pre-calculate allowed days
    const startDate = DateTime.fromISO(this.config.startDate);
    const endDate = DateTime.fromISO(this.config.endDate);

    // Pre-calculate eligible days based on config
    const eligibleDays = this.preCalculateEligibleDays(startDate, endDate);

    // Adjust the pattern function based on type
    switch (pattern) {
      case 'random':
        return this.generateOptimizedRandomPattern(eligibleDays);
      case 'gradient':
        return this.generateOptimizedGradientPattern(eligibleDays);
      case 'realistic':
        return this.generateOptimizedRealisticPattern(eligibleDays);
      default:
        // For other patterns, fall back to standard with eligible days
        return this.generateOptimizedDefaultPattern(eligibleDays, pattern);
    }
  }

  /**
   * Generate a simplified pattern as fallback for error cases
   * @returns Array of DateTime objects
   */
  private generateSimplifiedPattern(): DateTime[] {
    const dates: DateTime[] = [];
    const startDate = DateTime.fromISO(this.config.startDate);
    const endDate = DateTime.fromISO(this.config.endDate);
    const totalDays = Math.floor(endDate.diff(startDate, 'days').days);

    // Simple linear distribution
    for (let i = 0; i < this.config.commitCount; i++) {
      const daysToAdd = Math.floor((i / this.config.commitCount) * totalDays);
      const date = startDate.plus({ days: daysToAdd });

      // Add some time variation (1-23 hours)
      const hours = Math.floor(Math.random() * 23) + 1;
      const minutes = Math.floor(Math.random() * 60);

      dates.push(date.set({ hour: hours, minute: minutes }));
    }

    return dates;
  }

  /**
   * Pre-calculate eligible days based on configuration
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of eligible days
   */
  private preCalculateEligibleDays(startDate: DateTime, endDate: DateTime): DateTime[] {
    const eligibleDays: DateTime[] = [];
    let currentDate = startDate.startOf('day');

    while (currentDate <= endDate) {
      // Check if day is eligible based on config
      const dayOfWeek = currentDate.weekday % 7; // Convert to 0-based (0=Sunday)

      const isEligibleDay = this.config.activeDays.includes(dayOfWeek);
      const isEligibleWeekend = !this.shouldFilterWeekends() || !isWeekend(currentDate);
      const isEligibleHoliday = !this.config.respectHolidays ||
                               !isHoliday(currentDate, this.config.holidayCountry);

      if (isEligibleDay && isEligibleWeekend && isEligibleHoliday) {
        eligibleDays.push(currentDate);
      }

      currentDate = currentDate.plus({ days: 1 });
    }

    return eligibleDays;
  }

  /**
   * Generate optimized random pattern using pre-calculated eligible days
   * @param eligibleDays Array of eligible days
   * @returns Array of DateTime objects
   */
  private generateOptimizedRandomPattern(eligibleDays: DateTime[]): DateTime[] {
    const dates: DateTime[] = [];

    for (let i = 0; i < this.config.commitCount; i++) {
      const randomIndex = Math.floor(Math.random() * eligibleDays.length);
      const baseDate = eligibleDays[randomIndex];

      // Add time variation
      const { startHour, endHour } = getTimeOfDayRange(this.config.timeOfDay);
      const hours = startHour + Math.floor(Math.random() * (endHour - startHour));
      const minutes = Math.floor(Math.random() * 60);

      const commitDate = baseDate.set({ hour: hours, minute: minutes });
      dates.push(commitDate);
    }

    return dates;
  }

  /**
   * Generate optimized gradient pattern using pre-calculated eligible days
   * @param eligibleDays Array of eligible days
   * @returns Array of DateTime objects
   */
  private generateOptimizedGradientPattern(eligibleDays: DateTime[]): DateTime[] {
    const dates: DateTime[] = [];
    const segmentSize = Math.ceil(eligibleDays.length / 5);

    // Distribute commits with increasing density
    let commitIndex = 0;
    const commitsPerSegment = [
      Math.floor(this.config.commitCount * 0.05), // 5%
      Math.floor(this.config.commitCount * 0.15), // 15%
      Math.floor(this.config.commitCount * 0.25), // 25%
      Math.floor(this.config.commitCount * 0.25), // 25%
      Math.floor(this.config.commitCount * 0.30), // 30%
    ];

    // Adjust for rounding errors
    const totalAllocated = commitsPerSegment.reduce((sum, count) => sum + count, 0);
    commitsPerSegment[4] += (this.config.commitCount - totalAllocated);

    for (let segment = 0; segment < 5; segment++) {
      const segmentCommits = commitsPerSegment[segment];
      const segmentStart = segment * segmentSize;
      const segmentEnd = Math.min((segment + 1) * segmentSize, eligibleDays.length);
      const daysInSegment = segmentEnd - segmentStart;

      for (let i = 0; i < segmentCommits; i++) {
        const randomOffset = Math.floor(Math.random() * daysInSegment);
        const baseDate = eligibleDays[segmentStart + randomOffset];

        // Add time variation
        const { startHour, endHour } = getTimeOfDayRange(this.config.timeOfDay);
        const hours = startHour + Math.floor(Math.random() * (endHour - startHour));
        const minutes = Math.floor(Math.random() * 60);

        const commitDate = baseDate.set({ hour: hours, minute: minutes });
        dates.push(commitDate);
      }
    }

    return dates;
  }

  /**
   * Generate optimized realistic pattern using pre-calculated eligible days
   * @param eligibleDays Array of eligible days
   * @returns Array of DateTime objects
   */
  private generateOptimizedRealisticPattern(eligibleDays: DateTime[]): DateTime[] {
    const dates: DateTime[] = [];

    // Simulate project lifecycle
    let activityPattern: number[];

    switch (this.config.projectLifecycleSimulation) {
      case 'startup':
        // High initial activity, then plateau
        activityPattern = [0.4, 0.3, 0.2, 0.1];
        break;
      case 'maintenance':
        // Low steady activity
        activityPattern = [0.25, 0.25, 0.25, 0.25];
        break;
      case 'active-development':
        // Increasing activity
        activityPattern = [0.1, 0.2, 0.3, 0.4];
        break;
      default:
        // Balanced activity
        activityPattern = [0.25, 0.25, 0.25, 0.25];
    }

    // Divide timespan into 4 quarters
    const quarterSize = Math.ceil(eligibleDays.length / 4);

    // Calculate commits for each quarter
    const commitsPerQuarter = activityPattern.map(percentage =>
      Math.floor(this.config.commitCount * percentage)
    );

    // Adjust for rounding errors
    const totalAllocated = commitsPerQuarter.reduce((sum, count) => sum + count, 0);
    commitsPerQuarter[commitsPerQuarter.length - 1] += (this.config.commitCount - totalAllocated);

    // Generate commits for each quarter
    for (let quarter = 0; quarter < 4; quarter++) {
      const quarterCommits = commitsPerQuarter[quarter];
      const quarterStart = quarter * quarterSize;
      const quarterEnd = Math.min((quarter + 1) * quarterSize, eligibleDays.length);
      const daysInQuarter = quarterEnd - quarterStart;

      // Calculate streaks and gaps for realistic pattern
      let streakLength = 0;
      let gapLength = 0;

      for (let i = 0; i < quarterCommits; i++) {
        // Determine if we're in a streak or gap
        if (streakLength > 0) {
          // In a streak, add commits to consecutive days
          streakLength--;

          // Get next consecutive day
          const baseDate = eligibleDays[Math.min(quarterStart + i % daysInQuarter, quarterEnd - 1)];

          // Add 1-3 commits per day in a streak
          const commitsThisDay = 1 + Math.floor(Math.random() * 3);

          for (let j = 0; j < commitsThisDay; j++) {
            if (dates.length < this.config.commitCount) {
              const { startHour, endHour } = getTimeOfDayRange(this.config.timeOfDay);
              const hours = startHour + Math.floor(Math.random() * (endHour - startHour));
              const minutes = Math.floor(Math.random() * 60);

              const commitDate = baseDate.set({ hour: hours, minute: minutes });
              dates.push(commitDate);
            }
          }

          // Start a gap when streak ends
          if (streakLength === 0) {
            gapLength = 1 + Math.floor(Math.random() * 3);
          }

        } else if (gapLength > 0) {
          // In a gap, skip days
          gapLength--;

          // Start a new streak when gap ends
          if (gapLength === 0) {
            streakLength = 1 + Math.floor(Math.random() * 5);
          }

          // Skip this iteration (no commit)
          continue;

        } else {
          // Not in streak or gap, decide what to start
          if (Math.random() < 0.7) {
            // 70% chance to start a streak
            streakLength = 1 + Math.floor(Math.random() * 5);

            // Add commit for first day of streak
            const baseDate = eligibleDays[Math.min(quarterStart + i % daysInQuarter, quarterEnd - 1)];

            const { startHour, endHour } = getTimeOfDayRange(this.config.timeOfDay);
            const hours = startHour + Math.floor(Math.random() * (endHour - startHour));
            const minutes = Math.floor(Math.random() * 60);

            const commitDate = baseDate.set({ hour: hours, minute: minutes });
            dates.push(commitDate);

          } else {
            // 30% chance to start a gap
            gapLength = 1 + Math.floor(Math.random() * 3);

            // Skip this iteration (no commit)
            continue;
          }
        }
      }
    }

    // Sort dates and limit to commit count
    dates.sort((a, b) => a.toMillis() - b.toMillis());
    return dates.slice(0, this.config.commitCount);
  }

  /**
   * Generate optimized default pattern using pre-calculated eligible days
   * @param eligibleDays Array of eligible days
   * @param pattern Pattern name
   * @returns Array of DateTime objects
   */
  private generateOptimizedDefaultPattern(eligibleDays: DateTime[], pattern: string): DateTime[] {
    const dates: DateTime[] = [];

    // Simple uniform distribution for other patterns
    for (let i = 0; i < this.config.commitCount; i++) {
      const index = Math.floor((i / this.config.commitCount) * eligibleDays.length);
      const baseDate = eligibleDays[Math.min(index, eligibleDays.length - 1)];

      const { startHour, endHour } = getTimeOfDayRange(this.config.timeOfDay);
      const hours = startHour + Math.floor(Math.random() * (endHour - startHour));
      const minutes = Math.floor(Math.random() * 60);

      const commitDate = baseDate.set({ hour: hours, minute: minutes });
      dates.push(commitDate);
    }

    return dates;
  }

  /**
   * Generate random pattern
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of DateTime objects
   */
  private generateRandomPattern(startDate: DateTime, endDate: DateTime): DateTime[] {
    const dates: DateTime[] = [];

    for (let i = 0; i < this.config.commitCount; i++) {
      const date = generateRandomDate(startDate, endDate);

      // Adjust time of day
      const { startHour, endHour } = getTimeOfDayRange(this.config.timeOfDay);

      // Random time within range
      const hour = startHour + Math.floor(Math.random() * (endHour - startHour));
      const minute = Math.floor(Math.random() * 60);

      dates.push(date.set({ hour, minute }));
    }

    return dates;
  }

  /**
   * Generate gradient pattern
   * (dummy implementation - would be replaced with actual algorithm)
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of DateTime objects
   */
  private generateGradientPattern(startDate: DateTime, endDate: DateTime): DateTime[] {
    // Placeholder implementation
    return this.generateRandomPattern(startDate, endDate);
  }

  /**
   * Generate snake pattern
   * (dummy implementation - would be replaced with actual algorithm)
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of DateTime objects
   */
  private generateSnakePattern(startDate: DateTime, endDate: DateTime): DateTime[] {
    // Placeholder implementation
    return this.generateRandomPattern(startDate, endDate);
  }

  /**
   * Generate heart pattern
   * (dummy implementation - would be replaced with actual algorithm)
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of DateTime objects
   */
  private generateHeartPattern(startDate: DateTime, endDate: DateTime): DateTime[] {
    // Placeholder implementation
    return this.generateRandomPattern(startDate, endDate);
  }

  /**
   * Generate realistic pattern
   * (dummy implementation - would be replaced with actual algorithm)
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of DateTime objects
   */
  private generateRealisticPattern(startDate: DateTime, endDate: DateTime): DateTime[] {
    // Placeholder implementation
    return this.generateRandomPattern(startDate, endDate);
  }

  /**
   * Generate steady pattern
   * (dummy implementation - would be replaced with actual algorithm)
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of DateTime objects
   */
  private generateSteadyPattern(startDate: DateTime, endDate: DateTime): DateTime[] {
    // Placeholder implementation
    return this.generateRandomPattern(startDate, endDate);
  }

  /**
   * Generate crescendo pattern
   * (dummy implementation - would be replaced with actual algorithm)
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of DateTime objects
   */
  private generateCrescendoPattern(startDate: DateTime, endDate: DateTime): DateTime[] {
    // Placeholder implementation
    return this.generateRandomPattern(startDate, endDate);
  }

  /**
   * Generate custom pattern
   * (dummy implementation - would be replaced with actual algorithm)
   * @param startDate Start date
   * @param endDate End date
   * @returns Array of DateTime objects
   */
  private generateCustomPattern(startDate: DateTime, endDate: DateTime): DateTime[] {
    // Placeholder implementation
    return this.generateRandomPattern(startDate, endDate);
  }

  /**
   * Apply date filters to enforce configuration constraints
   * @param dates Dates to filter
   * @returns Filtered dates
   */
  private applyDateFilters(dates: DateTime[]): DateTime[] {
    let filteredDates = [...dates];

    // Filter weekends if needed
    if (this.shouldFilterWeekends()) {
      filteredDates = filteredDates.filter(date => !isWeekend(date));
    }

    // Filter holidays if needed
    if (this.config.respectHolidays && this.config.holidayCountry) {
      filteredDates = filteredDates.filter(date =>
        !isHoliday(date, this.config.holidayCountry)
      );
    }

    // If filtering removed dates, add more dates to reach target count
    if (filteredDates.length < this.config.commitCount) {
      const additionalDates = this.generateAdditionalDates(
        this.config.commitCount - filteredDates.length
      );

      filteredDates.push(...additionalDates);
    }

    return filteredDates.slice(0, this.config.commitCount);
  }

  /**
   * Generate additional dates to replace filtered ones
   * @param count Number of dates to generate
   * @returns Array of DateTime objects
   */
  private generateAdditionalDates(count: number): DateTime[] {
    const startDate = DateTime.fromISO(this.config.startDate);
    const endDate = DateTime.fromISO(this.config.endDate);
    const additionalDates: DateTime[] = [];

    const eligibleDays = this.preCalculateEligibleDays(startDate, endDate);

    for (let i = 0; i < count && eligibleDays.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * eligibleDays.length);
      const baseDate = eligibleDays[randomIndex];

      // Add time variation
      const { startHour, endHour } = getTimeOfDayRange(this.config.timeOfDay);
      const hours = startHour + Math.floor(Math.random() * (endHour - startHour));
      const minutes = Math.floor(Math.random() * 60);

      const commitDate = baseDate.set({ hour: hours, minute: minutes });
      additionalDates.push(commitDate);
    }

    return additionalDates;
  }

  /**
   * Apply time constraints to enforce minimum time between commits
   * @param dates Dates to adjust
   * @returns Adjusted dates
   */
  private applyTimeConstraints(dates: DateTime[]): DateTime[] {
    if (!this.config.minTimeBetweenCommits || this.config.minTimeBetweenCommits <= 0) {
      return dates;
    }

    // Sort dates chronologically
    const sortedDates = [...dates].sort((a, b) => a.toMillis() - b.toMillis());
    const adjustedDates: DateTime[] = [];

    // Add first date
    if (sortedDates.length > 0) {
      adjustedDates.push(sortedDates[0]);
    }

    // Process remaining dates
    for (let i = 1; i < sortedDates.length; i++) {
      const previousDate = adjustedDates[adjustedDates.length - 1];
      let currentDate = sortedDates[i];

      const minutesDiff = currentDate.diff(previousDate, 'minutes').minutes;

      // If time between commits is too small, adjust it
      if (minutesDiff < this.config.minTimeBetweenCommits) {
        currentDate = previousDate.plus({ minutes: this.config.minTimeBetweenCommits });

        // If adjustment pushes beyond end date, use a different strategy
        const endDate = DateTime.fromISO(this.config.endDate);
        if (currentDate > endDate) {
          // Instead, insert earlier (before previous commit)
          currentDate = previousDate.minus({ minutes: this.config.minTimeBetweenCommits });
        }
      }

      adjustedDates.push(currentDate);
    }

    return adjustedDates;
  }

  /**
   * Check if weekends should be filtered based on configuration
   * @returns True if weekends should be filtered
   */
  private shouldFilterWeekends(): boolean {
    // Check if configuration explicitly includes weekend days
    const hasWeekendDays = this.config.activeDays.some(day => day === 0 || day === 6);
    return !hasWeekendDays;
  }
}

/**
 * Create an optimized pattern generator
 * @param config Configuration to use
 * @returns OptimizedPatternGenerator instance
 */
export function createOptimizedGenerator(config: GraphifyConfig): OptimizedPatternGenerator {
  return new OptimizedPatternGenerator(config);
}
