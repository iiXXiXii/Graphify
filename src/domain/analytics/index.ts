import { DateTime } from 'luxon';
import { UIComponents } from '../../ui/formatters/components';
import { ThemeManager } from '../../ui/themes/theme';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GraphifyConfig, AnalyticsReport, UserBehaviorMetrics } from '../../types/config';
import { getErrorHandler } from '../../utils/errorHandler';

/**
 * Analytics data structure
 */
export interface CommitAnalytics {
  pattern: string;
  totalCommits: number;
  dateDistribution: Record<string, number>;
  weekdayDistribution: number[];
  timeDistribution: Record<number, number>;
  monthDistribution?: Record<string, number>;
  warnings: string[];
  insights?: Record<string, any>;
}

/**
 * Service for analyzing commit patterns and providing insights
 */
export class AnalyticsService {
  private ui: UIComponents;
  private theme: ThemeManager;

  constructor() {
    this.ui = new UIComponents();
    this.theme = ThemeManager.getInstance();
  }

  /**
   * Analyze a commit pattern and generate insights
   * @param dates The array of commit dates
   * @param pattern The name of the pattern used
   * @returns Analytics data with insights and warnings
   */
  analyzeCommitPattern(dates: DateTime[], pattern: string): CommitAnalytics {
    const totalCommits = dates.length;
    const warnings: string[] = [];

    // Date distribution
    const dateDistribution: Record<string, number> = {};
    for (const date of dates) {
      const dateStr = date.toISODate();
      if (dateStr) {
        dateDistribution[dateStr] = (dateDistribution[dateStr] || 0) + 1;
      }
    }

    // Weekday distribution (0 = Sunday, 6 = Saturday)
    const weekdayDistribution = Array(7).fill(0);
    for (const date of dates) {
      const dayOfWeek = date.weekday % 7;
      weekdayDistribution[dayOfWeek]++;
    }

    // Hour distribution
    const timeDistribution: Record<number, number> = {};
    for (const date of dates) {
      const hour = date.hour;
      timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
    }

    // Month distribution
    const monthDistribution: Record<string, number> = {};
    for (const date of dates) {
      const month = date.monthShort;
      monthDistribution[month] = (monthDistribution[month] || 0) + 1;
    }

    // Generate warnings
    this.generateWarnings(dates, weekdayDistribution, timeDistribution, warnings);

    // Generate insights
    const insights = this.generateInsights(dates, dateDistribution, weekdayDistribution, timeDistribution, monthDistribution);

    return {
      pattern,
      totalCommits,
      dateDistribution,
      weekdayDistribution,
      timeDistribution,
      monthDistribution,
      warnings,
      insights,
    };
  }

  /**
   * Generate warnings for potential issues in the commit pattern
   * @param dates The array of commit dates
   * @param weekdayDistribution The distribution of commits by weekday
   * @param timeDistribution The distribution of commits by hour
   * @param warnings Array to append warnings to
   * @private
   */
  private generateWarnings(
    dates: DateTime[],
    weekdayDistribution: number[],
    timeDistribution: Record<number, number>,
    warnings: string[]
  ): void {
    // Check for future dates
    const now = DateTime.now();
    const futureDates = dates.filter(date => date > now);
    if (futureDates.length > 0) {
      warnings.push(`${futureDates.length} commits are dated in the future.`);
    }

    // Check for very old dates
    const oneYearAgo = now.minus({ years: 1 });
    const veryOldDates = dates.filter(date => date < oneYearAgo.minus({ years: 2 }));
    if (veryOldDates.length > 0) {
      warnings.push(`${veryOldDates.length} commits are more than 3 years old.`);
    }

    // Check for suspicious weekend activity
    const weekdayTotal = weekdayDistribution[1] + weekdayDistribution[2] +
                        weekdayDistribution[3] + weekdayDistribution[4] +
                        weekdayDistribution[5]; // Mon-Fri

    const weekendTotal = weekdayDistribution[0] + weekdayDistribution[6]; // Sun, Sat

    if (weekendTotal > 0 && weekdayTotal === 0) {
      warnings.push('Commits only occur on weekends, which is unusual.');
    }

    // Check for suspicious time distribution
    const nightHours = [0, 1, 2, 3, 4, 5, 23];
    let nightCommits = 0;

    for (const hour of nightHours) {
      nightCommits += timeDistribution[hour] || 0;
    }

    if (nightCommits > dates.length * 0.5) {
      warnings.push('More than 50% of commits occur during typical sleeping hours (11pm-6am).');
    }

    // Check for uniform distribution (potentially artificial)
    const uniqueDates = Object.keys(dates.reduce((acc, date) => {
      const dateStr = date.toISODate();
      if (dateStr) acc[dateStr] = true;
      return acc;
    }, {} as Record<string, boolean>));

    if (uniqueDates.length > 7 && dates.length / uniqueDates.length >= 3) {
      warnings.push(`Average of ${(dates.length / uniqueDates.length).toFixed(1)} commits per active day is unusually high.`);
    }
  }

  /**
   * Generate insights from the commit pattern
   * @param dates The array of commit dates
   * @param dateDistribution The distribution of commits by date
   * @param weekdayDistribution The distribution of commits by weekday
   * @param timeDistribution The distribution of commits by hour
   * @param monthDistribution The distribution of commits by month
   * @returns Insights object
   * @private
   */
  private generateInsights(
    dates: DateTime[],
    dateDistribution: Record<string, number>,
    weekdayDistribution: number[],
    timeDistribution: Record<number, number>,
    monthDistribution: Record<string, number>
  ): Record<string, any> {
    // Calculate most active day
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let mostActiveDayIndex = 0;
    let mostActiveDayCount = 0;

    weekdayDistribution.forEach((count, index) => {
      if (count > mostActiveDayCount) {
        mostActiveDayCount = count;
        mostActiveDayIndex = index;
      }
    });

    const mostActiveDay = dayNames[mostActiveDayIndex];

    // Calculate most active hour
    let mostActiveHour = 0;
    let mostActiveHourCount = 0;

    Object.entries(timeDistribution).forEach(([hour, count]) => {
      if (count > mostActiveHourCount) {
        mostActiveHourCount = count;
        mostActiveHour = parseInt(hour, 10);
      }
    });

    const formatHour = (hour: number) => {
      if (hour === 0) return '12 AM';
      if (hour === 12) return '12 PM';
      return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
    };

    // Calculate most active month
    let mostActiveMonth = '';
    let mostActiveMonthCount = 0;

    Object.entries(monthDistribution).forEach(([month, count]) => {
      if (count > mostActiveMonthCount) {
        mostActiveMonthCount = count;
        mostActiveMonth = month;
      }
    });

    // Calculate activity streaks
    const streaks = this.calculateStreaks(dates);

    // Calculate time patterns
    const timePatterns = this.identifyTimePatterns(timeDistribution);

    // Calculate active days percentage
    const activeDays = Object.keys(dateDistribution).length;
    const dateRange = dates.length > 0
      ? Math.ceil(Math.abs(dates[dates.length - 1].diff(dates[0], 'days').days)) + 1
      : 0;

    const activeDaysPercentage = dateRange > 0
      ? (activeDays / dateRange) * 100
      : 0;

    return {
      mostActiveDay: {
        day: mostActiveDay,
        count: mostActiveDayCount,
        percentage: (mostActiveDayCount / dates.length) * 100
      },
      mostActiveTime: {
        hour: formatHour(mostActiveHour),
        count: mostActiveHourCount,
        percentage: (mostActiveHourCount / dates.length) * 100
      },
      mostActiveMonth: {
        month: mostActiveMonth,
        count: mostActiveMonthCount,
        percentage: (mostActiveMonthCount / dates.length) * 100
      },
      activityRate: {
        activeDays,
        totalDays: dateRange,
        percentage: activeDaysPercentage,
        averageCommitsPerActiveDay: dates.length / activeDays
      },
      longestStreak: streaks.longest,
      currentStreak: streaks.current,
      timePatterns
    };
  }

  /**
   * Calculate commit streaks
   * @param dates Array of commit dates
   * @returns Object with longest and current streak lengths
   * @private
   */
  private calculateStreaks(dates: DateTime[]): { longest: number, current: number } {
    if (dates.length === 0) {
      return { longest: 0, current: 0 };
    }

    // Get unique dates
    const uniqueDatesMap: Record<string, boolean> = {};
    dates.forEach(date => {
      const dateStr = date.toISODate();
      if (dateStr) uniqueDatesMap[dateStr] = true;
    });

    const uniqueDates = Object.keys(uniqueDatesMap).sort();

    // Calculate streaks
    let currentStreak = 1;
    let longestStreak = 1;
    let prevDate = DateTime.fromISO(uniqueDates[0]);

    for (let i = 1; i < uniqueDates.length; i++) {
      const currentDate = DateTime.fromISO(uniqueDates[i]);
      const diffDays = Math.round(currentDate.diff(prevDate, 'days').days);

      if (diffDays === 1) {
        // Consecutive day
        currentStreak++;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      } else {
        // Streak broken
        currentStreak = 1;
      }

      prevDate = currentDate;
    }

    // Check if current streak is still active
    const lastCommitDate = DateTime.fromISO(uniqueDates[uniqueDates.length - 1]);
    const today = DateTime.now().startOf('day');
    const daysSinceLastCommit = Math.round(today.diff(lastCommitDate, 'days').days);

    const isCurrentStreakActive = daysSinceLastCommit <= 1;

    return {
      longest: longestStreak,
      current: isCurrentStreakActive ? currentStreak : 0
    };
  }

  /**
   * Identify time patterns in commits
   * @param timeDistribution Distribution of commits by hour
   * @returns Object describing the identified time patterns
   * @private
   */
  private identifyTimePatterns(timeDistribution: Record<number, number>): Record<string, any> {
    const morningHours = [6, 7, 8, 9, 10, 11];
    const afternoonHours = [12, 13, 14, 15, 16, 17];
    const eveningHours = [18, 19, 20, 21, 22];
    const nightHours = [23, 0, 1, 2, 3, 4, 5];

    let morningCount = 0;
    let afternoonCount = 0;
    let eveningCount = 0;
    let nightCount = 0;

    let totalCommits = 0;

    for (const [hour, count] of Object.entries(timeDistribution)) {
      const hourNum = parseInt(hour, 10);
      totalCommits += count;

      if (morningHours.includes(hourNum)) {
        morningCount += count;
      } else if (afternoonHours.includes(hourNum)) {
        afternoonCount += count;
      } else if (eveningHours.includes(hourNum)) {
        eveningCount += count;
      } else if (nightHours.includes(hourNum)) {
        nightCount += count;
      }
    }

    // Determine work hours vs. after hours
    const workHours = morningCount + afternoonCount;
    const afterHours = eveningCount + nightCount;

    // Determine primary time period
    const timeData = [
      { name: 'morning', count: morningCount },
      { name: 'afternoon', count: afternoonCount },
      { name: 'evening', count: eveningCount },
      { name: 'night', count: nightCount }
    ];

    const primaryTimePeriod = timeData.reduce((max, period) =>
      period.count > max.count ? period : max,
      { name: 'unknown', count: 0 }
    );

    return {
      distribution: {
        morning: {
          count: morningCount,
          percentage: totalCommits > 0 ? (morningCount / totalCommits) * 100 : 0
        },
        afternoon: {
          count: afternoonCount,
          percentage: totalCommits > 0 ? (afternoonCount / totalCommits) * 100 : 0
        },
        evening: {
          count: eveningCount,
          percentage: totalCommits > 0 ? (eveningCount / totalCommits) * 100 : 0
        },
        night: {
          count: nightCount,
          percentage: totalCommits > 0 ? (nightCount / totalCommits) * 100 : 0
        }
      },
      primaryTimePeriod: primaryTimePeriod.name,
      workHoursPercentage: totalCommits > 0 ? (workHours / totalCommits) * 100 : 0,
      afterHoursPercentage: totalCommits > 0 ? (afterHours / totalCommits) * 100 : 0
    };
  }

  /**
   * Format analytics data for display
   * @param analytics The analytics data
   * @returns Formatted analytics string
   */
  formatAnalytics(analytics: CommitAnalytics): string {
    const { insights } = analytics;

    if (!insights) {
      return this.ui.info('No analytics insights available.');
    }

    let output = '';

    // Add header
    output += this.ui.sectionHeader('Commit Pattern Analytics');

    // Basic stats
    output += this.ui.labeledValue('Pattern', this.theme.highlight(analytics.pattern)) + '\n';
    output += this.ui.labeledValue('Total Commits', this.theme.highlight(String(analytics.totalCommits))) + '\n';

    // Activity overview
    output += this.ui.sectionHeader('Activity Overview');
    output += this.ui.labeledValue('Most Active Day', `${this.theme.highlight(insights.mostActiveDay.day)} (${Math.round(insights.mostActiveDay.percentage)}% of commits)`) + '\n';
    output += this.ui.labeledValue('Most Active Time', `${this.theme.highlight(insights.mostActiveTime.hour)} (${Math.round(insights.mostActiveTime.percentage)}% of commits)`) + '\n';
    output += this.ui.labeledValue('Most Active Month', `${this.theme.highlight(insights.mostActiveMonth.month)} (${Math.round(insights.mostActiveMonth.percentage)}% of commits)`) + '\n';

    // Streak info
    output += this.ui.sectionHeader('Streaks');
    output += this.ui.labeledValue('Longest Streak', `${this.theme.highlight(String(insights.longestStreak))} days`) + '\n';
    output += this.ui.labeledValue('Current Streak', `${this.theme.highlight(String(insights.currentStreak))} days`) + '\n';

    // Time patterns
    output += this.ui.sectionHeader('Time Patterns');
    output += this.ui.labeledValue('Primary Time Period', this.theme.highlight(insights.timePatterns.primaryTimePeriod.charAt(0).toUpperCase() + insights.timePatterns.primaryTimePeriod.slice(1))) + '\n';
    output += this.ui.labeledValue('Work Hours', `${Math.round(insights.timePatterns.workHoursPercentage)}%`) + '\n';
    output += this.ui.labeledValue('After Hours', `${Math.round(insights.timePatterns.afterHoursPercentage)}%`) + '\n';

    // Activity rate
    output += this.ui.sectionHeader('Activity Rate');
    output += this.ui.labeledValue('Active Days', `${insights.activityRate.activeDays} of ${insights.activityRate.totalDays} days (${Math.round(insights.activityRate.percentage)}%)`) + '\n';
    output += this.ui.labeledValue('Commits per Active Day', insights.activityRate.averageCommitsPerActiveDay.toFixed(1)) + '\n';

    // Warnings
    if (analytics.warnings.length > 0) {
      output += this.ui.sectionHeader('Warnings');

      for (const warning of analytics.warnings) {
        output += this.ui.warning(warning) + '\n';
      }
    }

    return output;
  }
}

/**
 * Enhanced Analytics System for Graphify
 *
 * This module provides comprehensive analytics and insights about user behavior,
 * pattern generation, and usage statistics to make the application more adaptive.
 */
export class AnalyticsSystem {
  private static instance: AnalyticsSystem;
  private static readonly ANALYTICS_DIR = path.join(os.homedir(), '.graphify', 'analytics');
  private static readonly USAGE_FILE = path.join(AnalyticsSystem.ANALYTICS_DIR, 'usage_metrics.json');
  private static readonly MAX_HISTORY_SIZE = 50; // Max number of reports to keep

  private userBehavior: UserBehaviorMetrics = {
    sessionCount: 0,
    patternUsage: {},
    commandUsage: {},
    averageCommitsPerPattern: {},
    featureUsage: {},
    lastActive: '',
    totalRuntime: 0,
    recentRepos: []
  };

  private sessionStartTime: DateTime;
  private errorHandler = getErrorHandler();

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.sessionStartTime = DateTime.now();
    this.initialize();
  }

  /**
   * Get the singleton instance
   * @returns AnalyticsSystem instance
   */
  public static getInstance(): AnalyticsSystem {
    if (!AnalyticsSystem.instance) {
      AnalyticsSystem.instance = new AnalyticsSystem();
    }
    return AnalyticsSystem.instance;
  }

  /**
   * Initialize the analytics system
   */
  private initialize(): void {
    try {
      // Create analytics directory if it doesn't exist
      if (!fs.existsSync(AnalyticsSystem.ANALYTICS_DIR)) {
        fs.mkdirSync(AnalyticsSystem.ANALYTICS_DIR, { recursive: true });
      }

      // Load existing analytics data
      this.loadUserBehavior();

      // Update session count
      this.userBehavior.sessionCount++;
      this.userBehavior.lastActive = DateTime.now().toISO();

      // Set up cleanup on process exit
      process.on('exit', () => this.saveUserBehavior());
      process.on('SIGINT', () => {
        this.saveUserBehavior();
        process.exit(0);
      });
    } catch (error) {
      // Non-critical error, just log it
      this.errorHandler.handle(error);
    }
  }

  /**
   * Load user behavior data from file
   */
  private loadUserBehavior(): void {
    try {
      if (fs.existsSync(AnalyticsSystem.USAGE_FILE)) {
        const data = fs.readFileSync(AnalyticsSystem.USAGE_FILE, 'utf8');
        const parsed = JSON.parse(data);
        this.userBehavior = {
          ...this.userBehavior,
          ...parsed
        };
      }
    } catch (error) {
      // If we can't read the file, we'll start fresh
      this.errorHandler.handle(error);
    }
  }

  /**
   * Save user behavior data to file
   */
  private saveUserBehavior(): void {
    try {
      // Update total runtime
      const sessionEnd = DateTime.now();
      const sessionRuntime = sessionEnd.diff(this.sessionStartTime, 'seconds').seconds;
      this.userBehavior.totalRuntime += sessionRuntime;

      fs.writeFileSync(
        AnalyticsSystem.USAGE_FILE,
        JSON.stringify(this.userBehavior, null, 2)
      );
    } catch (error) {
      // Non-critical error, just log it
      this.errorHandler.handle(error);
    }
  }

  /**
   * Track command usage
   * @param command The command being used
   */
  public trackCommandUsage(command: string): void {
    if (!this.userBehavior.commandUsage[command]) {
      this.userBehavior.commandUsage[command] = 0;
    }
    this.userBehavior.commandUsage[command]++;
  }

  /**
   * Track feature usage
   * @param feature The feature being used
   */
  public trackFeatureUsage(feature: string): void {
    if (!this.userBehavior.featureUsage[feature]) {
      this.userBehavior.featureUsage[feature] = 0;
    }
    this.userBehavior.featureUsage[feature]++;
  }

  /**
   * Track pattern usage
   * @param pattern The pattern being used
   * @param commitCount Number of commits generated with this pattern
   */
  public trackPatternUsage(pattern: string, commitCount: number): void {
    if (!this.userBehavior.patternUsage[pattern]) {
      this.userBehavior.patternUsage[pattern] = 0;
      this.userBehavior.averageCommitsPerPattern[pattern] = 0;
    }

    // Update usage count
    this.userBehavior.patternUsage[pattern]++;

    // Update average commits
    const currentTotal = this.userBehavior.averageCommitsPerPattern[pattern] *
      (this.userBehavior.patternUsage[pattern] - 1);
    const newAverage = (currentTotal + commitCount) / this.userBehavior.patternUsage[pattern];
    this.userBehavior.averageCommitsPerPattern[pattern] = newAverage;
  }

  /**
   * Track repository usage
   * @param repoPath Path to the repository
   */
  public trackRepository(repoPath: string): void {
    // Ensure repository is not already at the top
    this.userBehavior.recentRepos = this.userBehavior.recentRepos.filter(
      repo => repo !== repoPath
    );

    // Add to the beginning of the array
    this.userBehavior.recentRepos.unshift(repoPath);

    // Limit array size
    if (this.userBehavior.recentRepos.length > 10) {
      this.userBehavior.recentRepos = this.userBehavior.recentRepos.slice(0, 10);
    }
  }

  /**
   * Save an analytics report
   * @param report The analytics report to save
   * @param config The config used to generate it
   * @returns Path to the saved report
   */
  public saveAnalyticsReport(report: AnalyticsReport, config: GraphifyConfig): string {
    try {
      const timestamp = DateTime.now().toFormat('yyyy-MM-dd-HH-mm-ss');
      const reportPath = path.join(
        AnalyticsSystem.ANALYTICS_DIR,
        `report-${config.pattern}-${timestamp}.json`
      );

      fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: DateTime.now().toISO(),
        config,
        report
      }, null, 2));

      // Track this pattern usage
      this.trackPatternUsage(config.pattern || 'unknown', report.totalCommits);

      // Clean up old reports
      this.cleanupOldReports();

      return reportPath;
    } catch (error) {
      this.errorHandler.handle(error);
      return '';
    }
  }

  /**
   * Clean up old analytics reports
   */
  private cleanupOldReports(): void {
    try {
      // Get all report files
      const files = fs.readdirSync(AnalyticsSystem.ANALYTICS_DIR)
        .filter(file => file.startsWith('report-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(AnalyticsSystem.ANALYTICS_DIR, file),
          time: fs.statSync(path.join(AnalyticsSystem.ANALYTICS_DIR, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Sort by modification time (newest first)

      // Delete older files beyond the limit
      if (files.length > AnalyticsSystem.MAX_HISTORY_SIZE) {
        files.slice(AnalyticsSystem.MAX_HISTORY_SIZE).forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            // Ignore deletion errors
          }
        });
      }
    } catch (error) {
      // Non-critical, just log it
      this.errorHandler.handle(error);
    }
  }

  /**
   * Get user behavior metrics
   * @returns User behavior metrics
   */
  public getUserBehavior(): UserBehaviorMetrics {
    return { ...this.userBehavior };
  }

  /**
   * Get favorite pattern based on usage
   * @returns Most used pattern
   */
  public getFavoritePattern(): string {
    const patterns = Object.entries(this.userBehavior.patternUsage);
    if (patterns.length === 0) {
      return 'realistic'; // Default if no data
    }

    // Sort by usage count, descending
    patterns.sort((a, b) => b[1] - a[1]);
    return patterns[0][0];
  }

  /**
   * Get recommendation for commit count based on user history
   * @param pattern The pattern to get recommendations for
   * @returns Recommended commit count
   */
  public getCommitCountRecommendation(pattern: string): number {
    if (this.userBehavior.averageCommitsPerPattern[pattern]) {
      return Math.round(this.userBehavior.averageCommitsPerPattern[pattern]);
    }

    // Default values based on pattern
    switch (pattern) {
      case 'realistic':
        return 15;
      case 'random':
        return 30;
      default:
        return 20;
    }
  }

  /**
   * Get most used features
   * @param limit Maximum number of features to return
   * @returns Array of [feature, count] tuples
   */
  public getMostUsedFeatures(limit: number = 5): [string, number][] {
    return Object.entries(this.userBehavior.featureUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  /**
   * Get personalized suggestions based on user behavior
   * @returns Array of suggestion messages
   */
  public getPersonalizedSuggestions(): string[] {
    const suggestions: string[] = [];

    // Suggest features that haven't been used
    const unusedFeatures = [
      ['export', 'Try exporting your analytics to HTML with the "export" command'],
      ['validate', 'Validate your commit pattern with the "validate" command before applying it'],
      ['theme', 'Customize your experience with different themes using the "theme" command']
    ].filter(([feature]) => !this.userBehavior.featureUsage[feature]);

    if (unusedFeatures.length > 0) {
      // Randomly suggest one unused feature
      const randomFeature = unusedFeatures[Math.floor(Math.random() * unusedFeatures.length)];
      suggestions.push(randomFeature[1]);
    }

    // Suggest to try different patterns if user always uses the same one
    const patterns = Object.keys(this.userBehavior.patternUsage);
    if (patterns.length === 1 && this.userBehavior.sessionCount > 3) {
      suggestions.push('Try different contribution patterns to find one that suits your needs best.');
    }

    // Suggest backup if user has generated a lot of commits
    const totalCommits = Object.values(this.userBehavior.averageCommitsPerPattern)
      .reduce((sum, avg, i, arr) => sum + avg * arr.length, 0);

    if (totalCommits > 100 && !this.userBehavior.featureUsage['backup']) {
      suggestions.push('You\'ve generated a lot of commits. Consider using the backup feature to save your work.');
    }

    // Add more dynamic suggestions here as needed

    return suggestions;
  }
}

/**
 * Generate analytics report based on commit data
 * @param config Configuration used
 * @param dates Array of dates that commits were made on
 * @param times Array of times (HH:MM format) for commits
 * @returns Analytics report
 */
export function generateAnalytics(
  config: GraphifyConfig,
  dates: string[],
  times: string[]
): AnalyticsReport {
  // Initialize analytics data
  const analytics: AnalyticsReport = {
    pattern: config.pattern || 'random',
    totalCommits: dates.length,
    dateDistribution: {},
    weekdayDistribution: [0, 0, 0, 0, 0, 0, 0], // Sun-Sat
    timeDistribution: {},
    warnings: [],
  };

  // Process dates
  dates.forEach((date, index) => {
    // Add to date distribution
    if (!analytics.dateDistribution[date]) {
      analytics.dateDistribution[date] = 0;
    }
    analytics.dateDistribution[date]++;

    // Add to weekday distribution
    const weekday = DateTime.fromISO(date).weekday % 7; // Convert to 0-6 (Sun-Sat)
    analytics.weekdayDistribution[weekday]++;

    // Add to time distribution (by hour)
    if (times[index]) {
      const hour = times[index].split(':')[0];
      if (!analytics.timeDistribution[hour]) {
        analytics.timeDistribution[hour] = 0;
      }
      analytics.timeDistribution[hour]++;
    }
  });

  // Generate warnings based on patterns
  analytics.warnings = detectAnomalies(analytics, config);

  // Track analytics in the analytics system
  AnalyticsSystem.getInstance().saveAnalyticsReport(analytics, config);

  return analytics;
}

/**
 * Detect anomalies in the commit pattern with enhanced detection algorithms
 * @param analytics Analytics data
 * @param config Configuration used
 * @returns Array of warning messages
 */
function detectAnomalies(
  analytics: AnalyticsReport,
  config: GraphifyConfig
): string[] {
  const warnings: string[] = [];

  // Check for very high commit counts
  if (analytics.totalCommits > 500) {
    warnings.push('Very high commit count may look suspicious on GitHub');
  } else if (analytics.totalCommits > 200) {
    warnings.push('Moderately high commit count detected');
  }

  // Check for commits at unusual hours
  const lateNightCommits = Object.entries(analytics.timeDistribution)
    .filter(([hour]) => {
      const hourNum = parseInt(hour, 10);
      return hourNum >= 0 && hourNum < 6;
    })
    .reduce((sum, [_, count]) => sum + count, 0);

  const lateNightPercentage = (lateNightCommits / analytics.totalCommits) * 100;

  if (lateNightPercentage > 20) {
    warnings.push(`${lateNightPercentage.toFixed(1)}% of commits are between midnight and 6am`);
  }

  // Check for unnatural day distribution
  const weekdayTotal = analytics.weekdayDistribution.reduce((a, b) => a + b, 0);
  const weekdays = [1, 2, 3, 4, 5]; // Mon-Fri
  const weekends = [0, 6]; // Sun, Sat

  const weekdayCommits = weekdays.reduce((sum, day) => sum + analytics.weekdayDistribution[day], 0);
  const weekendCommits = weekends.reduce((sum, day) => sum + analytics.weekdayDistribution[day], 0);

  const weekdayPercentage = (weekdayCommits / weekdayTotal) * 100;
  const weekendPercentage = (weekendCommits / weekdayTotal) * 100;

  if (config.pattern === 'realistic' && weekendPercentage > 40) {
    warnings.push(`${weekendPercentage.toFixed(1)}% of commits are on weekends, which is high for a realistic pattern`);
  }

  // Check for excessive commits on a single day
  const maxDailyCommits = Math.max(...Object.values(analytics.dateDistribution));
  if (maxDailyCommits > 20) {
    warnings.push(`Maximum of ${maxDailyCommits} commits on a single day may look suspicious`);
  }

  // Check for long periods with no commits
  const dates = Object.keys(analytics.dateDistribution).sort();
  if (dates.length > 0) {
    let maxGap = 0;
    let currentGap = 0;
    let previousDate = DateTime.fromISO(dates[0]);

    for (let i = 1; i < dates.length; i++) {
      const currentDate = DateTime.fromISO(dates[i]);
      const gap = currentDate.diff(previousDate, 'days').days;

      if (gap > 1) {
        currentGap += gap - 1;
      } else {
        // Reset gap counter
        if (currentGap > maxGap) {
          maxGap = currentGap;
        }
        currentGap = 0;
      }

      previousDate = currentDate;
    }

    // Check final gap
    if (currentGap > maxGap) {
      maxGap = currentGap;
    }

    if (maxGap > 30 && config.pattern !== 'custom') {
      warnings.push(`Gap of ${maxGap} days without commits may look suspicious`);
    }
  }

  // Check for perfectly uniform distribution (which looks unnatural)
  const dateValues = Object.values(analytics.dateDistribution);
  if (dateValues.length > 5) {
    // Check if all values are the same
    const allSame = dateValues.every(v => v === dateValues[0]);
    if (allSame) {
      warnings.push('Perfectly uniform commit distribution may look suspicious');
    }
  }

  return warnings;
}

/**
 * Format analytics as a human-readable report
 * @param analytics Analytics data
 * @returns Formatted report string
 */
export function formatAnalyticsReport(analytics: AnalyticsReport): string {
  let report = '📊 Graphify Analytics Report\n';
  report += '==========================\n\n';

  // Basic information
  report += `Pattern: ${analytics.pattern}\n`;
  report += `Total Commits: ${analytics.totalCommits}\n\n`;

  // Weekday distribution
  report += 'Weekday Distribution:\n';
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxWeekdayCount = Math.max(...analytics.weekdayDistribution);

  analytics.weekdayDistribution.forEach((count, index) => {
    const percentage = ((count / analytics.totalCommits) * 100).toFixed(1);
    const barLength = Math.round((count / maxWeekdayCount) * 30);
    const bar = '█'.repeat(barLength);
    report += `  ${dayNames[index]}: ${bar} ${count} (${percentage}%)\n`;
  });

  report += '\n';

  // Time distribution
  report += 'Time Distribution:\n';
  const timeGroups = {
    'Morning (6am-12pm)': 0,
    'Afternoon (12pm-6pm)': 0,
    'Evening (6pm-12am)': 0,
    'Night (12am-6am)': 0,
  };

  Object.entries(analytics.timeDistribution).forEach(([hour, count]) => {
    const hourNum = parseInt(hour, 10);
    if (hourNum >= 6 && hourNum < 12) {
      timeGroups['Morning (6am-12pm)'] += count;
    } else if (hourNum >= 12 && hourNum < 18) {
      timeGroups['Afternoon (12pm-6pm)'] += count;
    } else if (hourNum >= 18) {
      timeGroups['Evening (6pm-12am)'] += count;
    } else {
      timeGroups['Night (12am-6am)'] += count;
    }
  });

  Object.entries(timeGroups).forEach(([name, count]) => {
    const percentage = ((count / analytics.totalCommits) * 100).toFixed(1);
    report += `  ${name}: ${count} (${percentage}%)\n`;
  });

  report += '\n';

  // Date range
  const dates = Object.keys(analytics.dateDistribution).sort();
  if (dates.length > 0) {
    const firstDate = DateTime.fromISO(dates[0]).toFormat('yyyy-MM-dd');
    const lastDate = DateTime.fromISO(dates[dates.length - 1]).toFormat('yyyy-MM-dd');
    const dayRange = DateTime.fromISO(dates[dates.length - 1])
      .diff(DateTime.fromISO(dates[0]), 'days')
      .days + 1;

    report += `Date Range: ${firstDate} to ${lastDate} (${dayRange} days)\n`;
    report += `Commit Frequency: ${(analytics.totalCommits / dayRange).toFixed(2)} commits/day\n\n`;
  }

  // Warnings
  if (analytics.warnings.length > 0) {
    report += 'Warnings:\n';
    analytics.warnings.forEach(warning => {
      report += `  ⚠️  ${warning}\n`;
    });
    report += '\n';
  } else {
    report += '✅ No warnings or anomalies detected.\n\n';
  }

  // Personalized suggestions
  const suggestions = AnalyticsSystem.getInstance().getPersonalizedSuggestions();
  if (suggestions.length > 0) {
    report += 'Suggestions:\n';
    suggestions.forEach(suggestion => {
      report += `  💡 ${suggestion}\n`;
    });
    report += '\n';
  }

  report += 'Generated by Graphify - GitHub Contribution Graph Generator\n';

  return report;
}

/**
 * Get HTML representation of the analytics report with enhanced visualizations
 * @param analytics Analytics data
 * @returns HTML string
 */
export function generateHtmlReport(analytics: AnalyticsReport): string {
  // Create HTML report with enhanced charts
  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Graphify Analytics Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; }
    h1, h2 { color: #0366d6; }
    .card { background: #fff; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); padding: 20px; margin-bottom: 20px; }
    .warning { background-color: #fffbdd; border-left: 4px solid #daa520; padding: 10px; margin-bottom: 10px; }
    .suggestion { background-color: #e6f6ff; border-left: 4px solid #0366d6; padding: 10px; margin-bottom: 10px; }
    .bar-chart { width: 100%; background-color: #f1f1f1; margin-bottom: 5px; border-radius: 4px; overflow: hidden; }
    .bar { height: 30px; background-color: #0366d6; color: white; text-align: right; padding-right: 10px; line-height: 30px; border-radius: 4px; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
    .calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin: 20px 0; }
    .calendar-day { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; background-color: #ebedf0; border-radius: 2px; font-size: 10px; }
    .calendar-day.l1 { background-color: #9be9a8; }
    .calendar-day.l2 { background-color: #40c463; }
    .calendar-day.l3 { background-color: #30a14e; }
    .calendar-day.l4 { background-color: #216e39; }
    .heatmap { width: 100%; height: 50px; margin: 20px 0; display: flex; }
    .heatmap-segment { flex: 1; height: 100%; }
    .progress-container { background-color: #f1f1f1; border-radius: 4px; margin: 10px 0; }
    .progress-bar { height: 20px; background-color: #4caf50; text-align: center; color: white; border-radius: 4px; }
    .flex-container { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .flex-item { flex-basis: 48%; }
    .center { text-align: center; }
  </style>
</head>
<body>
  <h1>Graphify Analytics Report</h1>

  <div class="card">
    <h2>Overview</h2>
    <p><strong>Pattern:</strong> ${analytics.pattern}</p>
    <p><strong>Total Commits:</strong> ${analytics.totalCommits}</p>
  `;

  // Date range
  const dates = Object.keys(analytics.dateDistribution).sort();
  if (dates.length > 0) {
    const firstDate = DateTime.fromISO(dates[0]).toFormat('yyyy-MM-dd');
    const lastDate = DateTime.fromISO(dates[dates.length - 1]).toFormat('yyyy-MM-dd');
    const dayRange = DateTime.fromISO(dates[dates.length - 1])
      .diff(DateTime.fromISO(dates[0]), 'days')
      .days + 1;

    html += `
    <p><strong>Date Range:</strong> ${firstDate} to ${lastDate} (${dayRange} days)</p>
    <p><strong>Commit Frequency:</strong> ${(analytics.totalCommits / dayRange).toFixed(2)} commits/day</p>
    `;

    // Add a progress bar showing the percentage of days with commits
    const daysWithCommits = Object.keys(analytics.dateDistribution).length;
    const commitPercentage = (daysWithCommits / dayRange) * 100;

    html += `
    <p><strong>Days with Commits:</strong> ${daysWithCommits} out of ${dayRange} (${commitPercentage.toFixed(1)}%)</p>
    <div class="progress-container">
      <div class="progress-bar" style="width: ${commitPercentage}%">${commitPercentage.toFixed(1)}%</div>
    </div>
    `;
  }

  html += `</div>`;

  // Activity heatmap (simplified version of GitHub's contribution graph)
  if (dates.length > 0) {
    html += `
    <div class="card">
      <h2>Contribution Heatmap</h2>
      <p>A simplified representation of your contribution pattern:</p>
      <div class="calendar">
    `;

    // Find the maximum number of commits in a day for scaling
    const maxCommitsPerDay = Math.max(...Object.values(analytics.dateDistribution));

    // Create a simple calendar visualization
    const startDate = DateTime.fromISO(dates[0]);
    const endDate = DateTime.fromISO(dates[dates.length - 1]);
    const totalDays = endDate.diff(startDate, 'days').days + 1;
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // Add a header row with day names
    dayNames.forEach(day => {
      html += `<div class="calendar-header">${day}</div>`;
    });

    // Calculate starting offset based on the day of the week
    const startOffset = startDate.weekday % 7;

    // Add empty cells for offset
    for (let i = 0; i < startOffset; i++) {
      html += `<div class="calendar-day"></div>`;
    }

    // Add cells for each day in the range
    for (let i = 0; i < totalDays; i++) {
      const currentDate = startDate.plus({ days: i });
      const dateString = currentDate.toFormat('yyyy-MM-dd');
      const commitCount = analytics.dateDistribution[dateString] || 0;

      // Determine intensity level (0-4)
      let intensityClass = '';
      if (commitCount > 0) {
        const relativeIntensity = commitCount / maxCommitsPerDay;
        if (relativeIntensity <= 0.25) intensityClass = 'l1';
        else if (relativeIntensity <= 0.5) intensityClass = 'l2';
        else if (relativeIntensity <= 0.75) intensityClass = 'l3';
        else intensityClass = 'l4';
      }

      html += `<div class="calendar-day ${intensityClass}" title="${dateString}: ${commitCount} commits">${commitCount > 0 ? commitCount : ''}</div>`;
    }

    html += `
      </div>
    </div>
    `;
  }

  // Weekday and Time distribution in a flex container
  html += `
  <div class="flex-container">
    <div class="flex-item card">
      <h2>Weekday Distribution</h2>
  `;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const maxWeekdayCount = Math.max(...analytics.weekdayDistribution);

  analytics.weekdayDistribution.forEach((count, index) => {
    const percentage = ((count / analytics.totalCommits) * 100).toFixed(1);
    const barWidth = count > 0 ? Math.max((count / maxWeekdayCount) * 100, 5) : 0;

    html += `
    <p><strong>${dayNames[index]}:</strong> ${count} (${percentage}%)</p>
    <div class="bar-chart">
      <div class="bar" style="width: ${barWidth}%">${count}</div>
    </div>
    `;
  });

  html += `
    </div>
    <div class="flex-item card">
      <h2>Time Distribution</h2>
  `;

  const timeGroups = {
    'Morning (6am-12pm)': 0,
    'Afternoon (12pm-6pm)': 0,
    'Evening (6pm-12am)': 0,
    'Night (12am-6am)': 0,
  };

  Object.entries(analytics.timeDistribution).forEach(([hour, count]) => {
    const hourNum = parseInt(hour, 10);
    if (hourNum >= 6 && hourNum < 12) {
      timeGroups['Morning (6am-12pm)'] += count;
    } else if (hourNum >= 12 && hourNum < 18) {
      timeGroups['Afternoon (12pm-6pm)'] += count;
    } else if (hourNum >= 18) {
      timeGroups['Evening (6pm-12am)'] += count;
    } else {
      timeGroups['Night (12am-6am)'] += count;
    }
  });

  const maxTimeCount = Math.max(...Object.values(timeGroups));

  Object.entries(timeGroups).forEach(([name, count]) => {
    const percentage = ((count / analytics.totalCommits) * 100).toFixed(1);
    const barWidth = count > 0 ? Math.max((count / maxTimeCount) * 100, 5) : 0;

    html += `
    <p><strong>${name}:</strong> ${count} (${percentage}%)</p>
    <div class="bar-chart">
      <div class="bar" style="width: ${barWidth}%">${count}</div>
    </div>
    `;
  });

  html += `
    </div>
  </div>
  `;

  // Pattern appropriateness score
  html += `
  <div class="card">
    <h2>Pattern Analysis</h2>
  `;

  // Calculate a "realism score" based on various factors
  let realismScore = 100;

  // Deduct for uniform distribution
  const dateValues = Object.values(analytics.dateDistribution);
  if (dateValues.length > 5) {
    const allSame = dateValues.every(v => v === dateValues[0]);
    if (allSame) {
      realismScore -= 20;
    }
  }

  // Deduct for excessive weekend activity in realistic pattern
  if (analytics.pattern === 'realistic') {
    const weekdayTotal = analytics.weekdayDistribution.reduce((a, b) => a + b, 0);
    const weekends = [0, 6]; // Sun, Sat
    const weekendCommits = weekends.reduce((sum, day) => sum + analytics.weekdayDistribution[day], 0);
    const weekendPercentage = (weekendCommits / weekdayTotal) * 100;

    if (weekendPercentage > 40) {
      realismScore -= Math.min(20, (weekendPercentage - 40) * 0.5);
    }
  }

  // Deduct for commits at unusual hours
  const lateNightCommits = Object.entries(analytics.timeDistribution)
    .filter(([hour]) => {
      const hourNum = parseInt(hour, 10);
      return hourNum >= 0 && hourNum < 6;
    })
    .reduce((sum, [_, count]) => sum + count, 0);

  const lateNightPercentage = (lateNightCommits / analytics.totalCommits) * 100;

  if (lateNightPercentage > 20) {
    realismScore -= Math.min(15, (lateNightPercentage - 20) * 0.75);
  }

  // Cap score between 0 and 100
  realismScore = Math.max(0, Math.min(100, realismScore));

  // Determine color based on score
  let scoreColor;
  if (realismScore >= 80) {
    scoreColor = '#4caf50'; // Green
  } else if (realismScore >= 60) {
    scoreColor = '#ff9800'; // Orange
  } else {
    scoreColor = '#f44336'; // Red
  }

  html += `
    <div class="center">
      <h3>Realism Score</h3>
      <div style="font-size: 3em; font-weight: bold; color: ${scoreColor};">${Math.round(realismScore)}%</div>
      <p>${getScoreDescription(realismScore)}</p>
      <div class="progress-container">
        <div class="progress-bar" style="width: ${realismScore}%; background-color: ${scoreColor}"></div>
      </div>
    </div>
  `;

  html += `</div>`;

  // Warnings
  if (analytics.warnings.length > 0) {
    html += `
    <div class="card">
      <h2>Warnings</h2>
    `;

    analytics.warnings.forEach(warning => {
      html += `<div class="warning">⚠️ ${warning}</div>`;
    });

    html += `</div>`;
  }

  // Personalized suggestions
  const suggestions = AnalyticsSystem.getInstance().getPersonalizedSuggestions();
  if (suggestions.length > 0) {
    html += `
    <div class="card">
      <h2>Suggestions</h2>
    `;

    suggestions.forEach(suggestion => {
      html += `<div class="suggestion">💡 ${suggestion}</div>`;
    });

    html += `</div>`;
  }

  html += `
  <div class="footer">
    <p>Generated by Graphify - GitHub Contribution Graph Generator</p>
    <p>${DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss')}</p>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Get a description for a realism score
 * @param score The realism score (0-100)
 * @returns Description text
 */
function getScoreDescription(score: number): string {
  if (score >= 90) {
    return 'Excellent! This pattern appears highly natural and realistic.';
  } else if (score >= 80) {
    return 'Very good! This pattern has a natural appearance.';
  } else if (score >= 70) {
    return 'Good. The pattern is mostly realistic with some minor issues.';
  } else if (score >= 60) {
    return 'Acceptable, but has some characteristics that may appear unnatural.';
  } else if (score >= 50) {
    return 'Needs improvement. Several aspects of this pattern may appear artificial.';
  } else {
    return 'This pattern contains several elements that make it look artificial.';
  }
}

/**
 * Get JSON representation of the analytics report
 * @param analytics Analytics data
 * @returns JSON string
 */
export function generateJsonReport(analytics: AnalyticsReport): string {
  return JSON.stringify(analytics, null, 2);
}
