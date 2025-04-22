import { GraphifyConfig, AnalyticsReport } from '../../types/config';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { UserPreferences } from '../config/user-preferences';

/**
 * Event types that can be tracked
 */
export enum AnalyticsEventType {
  COMMAND_EXECUTED = 'command_executed',
  PATTERN_GENERATED = 'pattern_generated',
  ERROR_OCCURRED = 'error_occurred',
  FEATURE_USED = 'feature_used',
  SETTINGS_CHANGED = 'settings_changed',
  SESSION_STARTED = 'session_started',
  SESSION_ENDED = 'session_ended'
}

/**
 * Interface for analytics events
 */
export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Analytics summary information
 */
export interface AnalyticsSummary {
  totalSessions: number;
  activeUsageDays: number;
  mostUsedCommands: Array<{ command: string; count: number }>;
  mostUsedPatterns: Array<{ pattern: string; count: number }>;
  averageSessionDuration: number; // in seconds
  errorRate: number; // percentage of commands that result in errors
  userEfficiency: number; // metric from 0-100 on workflow efficiency
  lastActiveDate: string;
  mostActiveTimeOfDay: string;
}

/**
 * Advanced Analytics Manager for tracking user behavior and application usage
 */
export class AdvancedAnalyticsManager {
  private static instance: AdvancedAnalyticsManager;
  private dataDirectory: string;
  private eventsFile: string;
  private insightsFile: string;
  private currentSessionId: string;
  private sessionStartTime: DateTime;
  private enabled: boolean;
  private userPreferences: UserPreferences;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private static readonly FLUSH_DELAY = 2000; // ms between write operations

  /**
   * Private constructor (singleton pattern)
   */
  private constructor() {
    this.dataDirectory = path.join(os.homedir(), '.graphify', 'analytics');
    this.eventsFile = path.join(this.dataDirectory, 'events.json');
    this.insightsFile = path.join(this.dataDirectory, 'insights.json');
    this.currentSessionId = this.generateSessionId();
    this.sessionStartTime = DateTime.now();
    this.userPreferences = new UserPreferences();
    this.enabled = this.userPreferences.get('analytics.enabled') !== false;

    // Create data directory if it doesn't exist
    this.initializeDataDirectory();

    // Start session
    this.trackEvent(AnalyticsEventType.SESSION_STARTED, {
      nodeVersion: process.version,
      platform: process.platform,
      osVersion: os.release(),
      memory: Math.round(os.totalmem() / 1024 / 1024),
      cpus: os.cpus().length
    });

    // Set up periodic flushing
    this.flushInterval = setInterval(() => this.flushEvents(), AdvancedAnalyticsManager.FLUSH_DELAY);

    // Register exit handler to track session end
    process.on('exit', () => this.handleExit());
    process.on('SIGINT', () => this.handleExit());
    process.on('SIGTERM', () => this.handleExit());
  }

  /**
   * Get singleton instance
   * @returns AdvancedAnalyticsManager instance
   */
  public static getInstance(): AdvancedAnalyticsManager {
    if (!AdvancedAnalyticsManager.instance) {
      AdvancedAnalyticsManager.instance = new AdvancedAnalyticsManager();
    }
    return AdvancedAnalyticsManager.instance;
  }

  /**
   * Initialize the data directory
   */
  private initializeDataDirectory(): void {
    try {
      if (!fs.existsSync(this.dataDirectory)) {
        fs.mkdirSync(this.dataDirectory, { recursive: true });
      }

      // Initialize events file if it doesn't exist
      if (!fs.existsSync(this.eventsFile)) {
        fs.writeFileSync(this.eventsFile, JSON.stringify([]));
      }

      // Initialize insights file if it doesn't exist
      if (!fs.existsSync(this.insightsFile)) {
        fs.writeFileSync(this.insightsFile, JSON.stringify({
          totalSessions: 0,
          activeUsageDays: 0,
          mostUsedCommands: [],
          mostUsedPatterns: [],
          averageSessionDuration: 0,
          errorRate: 0,
          userEfficiency: 50,
          lastActiveDate: '',
          mostActiveTimeOfDay: ''
        }));
      }
    } catch (error) {
      console.error('Failed to initialize analytics directory:', error);
      // Disable analytics if initialization fails
      this.enabled = false;
    }
  }

  /**
   * Generate a unique session ID
   * @returns Session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Track an analytics event
   * @param type Event type
   * @param data Event data
   * @returns True if event was tracked successfully
   */
  public trackEvent(type: AnalyticsEventType, data: Record<string, any> = {}): boolean {
    if (!this.enabled) {
      return false;
    }

    const event: AnalyticsEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      timestamp: new Date().toISOString(),
      data: {
        ...data,
        sessionId: this.currentSessionId
      }
    };

    // Queue the event for batch processing
    this.eventQueue.push(event);

    // Flush immediately for important events
    if ([AnalyticsEventType.SESSION_STARTED, AnalyticsEventType.SESSION_ENDED, AnalyticsEventType.ERROR_OCCURRED].includes(type)) {
      this.flushEvents();
    }

    return true;
  }

  /**
   * Flush queued events to storage
   */
  private flushEvents(): void {
    if (this.eventQueue.length === 0) {
      return;
    }

    try {
      // Read existing events
      let events: AnalyticsEvent[] = [];
      if (fs.existsSync(this.eventsFile)) {
        const content = fs.readFileSync(this.eventsFile, 'utf-8');
        events = JSON.parse(content);
      }

      // Add new events
      events = [...events, ...this.eventQueue];

      // Limit size to prevent file from growing too large
      if (events.length > 10000) {
        events = events.slice(-10000);
      }

      // Write back to file
      fs.writeFileSync(this.eventsFile, JSON.stringify(events));

      // Clear the queue
      this.eventQueue = [];

      // Update insights after flushing events
      this.updateInsights();
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
    }
  }

  /**
   * Handle process exit to track session end
   */
  private handleExit(): void {
    // Track session end with duration
    const sessionEndTime = DateTime.now();
    const durationSeconds = sessionEndTime.diff(this.sessionStartTime, 'seconds').seconds;

    this.trackEvent(AnalyticsEventType.SESSION_ENDED, {
      durationSeconds,
      timestamp: sessionEndTime.toISO()
    });

    // Force flush events
    this.flushEvents();

    // Clear interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }

  /**
   * Update analytics insights based on collected data
   */
  private updateInsights(): void {
    try {
      const events = this.getEvents();
      if (events.length === 0) {
        return;
      }

      const sessions = this.extractSessions(events);
      const commands = this.extractCommands(events);
      const patterns = this.extractPatterns(events);
      const errors = this.extractErrors(events);
      const activeDays = this.extractActiveDays(events);
      const timeDistribution = this.extractTimeDistribution(events);

      // Calculate insights
      const totalSessions = sessions.length;
      const mostUsedCommands = this.getMostFrequent(commands, 5);
      const mostUsedPatterns = this.getMostFrequent(patterns, 5);
      const averageSessionDuration = this.calculateAverageSessionDuration(sessions);
      const errorRate = this.calculateErrorRate(commands.length, errors.length);
      const userEfficiency = this.calculateUserEfficiency(sessions, commands, errors);
      const lastActiveDate = events.length > 0 ?
        DateTime.fromISO(events[events.length - 1].timestamp).toFormat('yyyy-MM-dd') : '';
      const mostActiveTimeOfDay = this.getMostActiveTimeOfDay(timeDistribution);

      // Create insights object
      const insights: AnalyticsSummary = {
        totalSessions,
        activeUsageDays: activeDays.size,
        mostUsedCommands,
        mostUsedPatterns,
        averageSessionDuration,
        errorRate,
        userEfficiency,
        lastActiveDate,
        mostActiveTimeOfDay
      };

      // Write insights to file
      fs.writeFileSync(this.insightsFile, JSON.stringify(insights));

    } catch (error) {
      console.error('Failed to update analytics insights:', error);
    }
  }

  /**
   * Extract unique sessions from events
   * @param events Analytics events
   * @returns Array of session objects
   */
  private extractSessions(events: AnalyticsEvent[]): Array<{
    id: string;
    start: string;
    end?: string;
    duration?: number;
  }> {
    const sessionMap = new Map<string, {
      id: string;
      start: string;
      end?: string;
      duration?: number;
    }>();

    events.forEach(event => {
      const sessionId = event.data.sessionId;
      if (!sessionId) return;

      if (event.type === AnalyticsEventType.SESSION_STARTED) {
        sessionMap.set(sessionId, {
          id: sessionId,
          start: event.timestamp
        });
      } else if (event.type === AnalyticsEventType.SESSION_ENDED) {
        const session = sessionMap.get(sessionId);
        if (session) {
          session.end = event.timestamp;
          session.duration = event.data.durationSeconds;
        }
      }
    });

    return Array.from(sessionMap.values());
  }

  /**
   * Extract command usage from events
   * @param events Analytics events
   * @returns Array of command strings
   */
  private extractCommands(events: AnalyticsEvent[]): string[] {
    return events
      .filter(event => event.type === AnalyticsEventType.COMMAND_EXECUTED)
      .map(event => event.data.command)
      .filter(Boolean);
  }

  /**
   * Extract pattern usage from events
   * @param events Analytics events
   * @returns Array of pattern strings
   */
  private extractPatterns(events: AnalyticsEvent[]): string[] {
    return events
      .filter(event => event.type === AnalyticsEventType.PATTERN_GENERATED)
      .map(event => event.data.pattern)
      .filter(Boolean);
  }

  /**
   * Extract error events
   * @param events Analytics events
   * @returns Array of error events
   */
  private extractErrors(events: AnalyticsEvent[]): AnalyticsEvent[] {
    return events.filter(event => event.type === AnalyticsEventType.ERROR_OCCURRED);
  }

  /**
   * Extract active usage days from events
   * @param events Analytics events
   * @returns Set of active day strings (YYYY-MM-DD)
   */
  private extractActiveDays(events: AnalyticsEvent[]): Set<string> {
    return new Set(
      events.map(event => DateTime.fromISO(event.timestamp).toFormat('yyyy-MM-dd'))
    );
  }

  /**
   * Extract time of day distribution from events
   * @param events Analytics events
   * @returns Map of hour (0-23) to count
   */
  private extractTimeDistribution(events: AnalyticsEvent[]): Map<number, number> {
    const hourCounts = new Map<number, number>();

    events.forEach(event => {
      const hour = DateTime.fromISO(event.timestamp).hour;
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    return hourCounts;
  }

  /**
   * Get most frequently occurring items
   * @param items Array of items
   * @param limit Maximum number of items to return
   * @returns Array of item and count pairs
   */
  private getMostFrequent<T>(items: T[], limit: number): Array<{ command: string; count: number }> {
    const counts = new Map<string, number>();

    items.forEach(item => {
      const key = String(item);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([command, count]) => ({ command, count }));
  }

  /**
   * Calculate average session duration
   * @param sessions Array of session objects
   * @returns Average duration in seconds
   */
  private calculateAverageSessionDuration(sessions: Array<{
    id: string;
    start: string;
    end?: string;
    duration?: number;
  }>): number {
    const sessionsWithDuration = sessions.filter(s => s.duration !== undefined);

    if (sessionsWithDuration.length === 0) {
      return 0;
    }

    const totalDuration = sessionsWithDuration.reduce((sum, session) => sum + (session.duration || 0), 0);
    return Math.round(totalDuration / sessionsWithDuration.length);
  }

  /**
   * Calculate error rate as percentage of commands
   * @param commandCount Number of commands executed
   * @param errorCount Number of errors encountered
   * @returns Error rate (0-100)
   */
  private calculateErrorRate(commandCount: number, errorCount: number): number {
    if (commandCount === 0) return 0;
    return Math.round((errorCount / commandCount) * 100);
  }

  /**
   * Calculate user efficiency score
   * @param sessions Array of session objects
   * @param commands Array of command strings
   * @param errors Array of error events
   * @returns Efficiency score (0-100)
   */
  private calculateUserEfficiency(
    sessions: Array<{ id: string; start: string; end?: string; duration?: number }>,
    commands: string[],
    errors: AnalyticsEvent[]
  ): number {
    // This is a complex metric that combines multiple factors
    // Start with a base score
    let score = 50;

    // Factor 1: Error rate (lower is better)
    const errorRate = this.calculateErrorRate(commands.length, errors.length);
    score += Math.max(-25, Math.min(25, 25 - errorRate));

    // Factor 2: Command diversity (higher is better)
    const uniqueCommandsRatio = new Set(commands).size / Math.max(1, commands.length);
    score += Math.round(uniqueCommandsRatio * 10);

    // Factor 3: Session consistency (higher is better)
    if (sessions.length > 0) {
      const consistencyScore = Math.min(15, sessions.length);
      score += consistencyScore;
    }

    // Cap at 0-100 range
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get the most active time of day
   * @param hourCounts Map of hour to activity count
   * @returns String representation of most active time
   */
  private getMostActiveTimeOfDay(hourCounts: Map<number, number>): string {
    if (hourCounts.size === 0) return 'Unknown';

    let maxHour = 0;
    let maxCount = 0;

    hourCounts.forEach((count, hour) => {
      if (count > maxCount) {
        maxCount = count;
        maxHour = hour;
      }
    });

    // Format as 12-hour time period
    const period = maxHour < 12 ? 'AM' : 'PM';
    const displayHour = maxHour % 12 === 0 ? 12 : maxHour % 12;

    return `${displayHour} ${period}`;
  }

  /**
   * Get all recorded events
   * @param limit Maximum number of events to return (0 for all)
   * @param filterType Optional event type filter
   * @returns Array of analytics events
   */
  public getEvents(limit: number = 0, filterType?: AnalyticsEventType): AnalyticsEvent[] {
    try {
      if (!fs.existsSync(this.eventsFile)) {
        return [];
      }

      // Flush any pending events
      this.flushEvents();

      const content = fs.readFileSync(this.eventsFile, 'utf-8');
      let events: AnalyticsEvent[] = JSON.parse(content);

      // Apply type filter if specified
      if (filterType) {
        events = events.filter(event => event.type === filterType);
      }

      // Apply limit if specified
      if (limit > 0 && events.length > limit) {
        events = events.slice(-limit);
      }

      return events;
    } catch (error) {
      console.error('Failed to read analytics events:', error);
      return [];
    }
  }

  /**
   * Get analytics summary
   * @returns Analytics summary or null if not available
   */
  public getSummary(): AnalyticsSummary | null {
    try {
      if (!fs.existsSync(this.insightsFile)) {
        return null;
      }

      const content = fs.readFileSync(this.insightsFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read analytics insights:', error);
      return null;
    }
  }

  /**
   * Enable or disable analytics
   * @param enabled Whether analytics should be enabled
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.userPreferences.set('analytics.enabled', enabled);

    // Track setting change
    if (enabled) {
      this.trackEvent(AnalyticsEventType.SETTINGS_CHANGED, {
        setting: 'analytics.enabled',
        value: true
      });
    }
  }

  /**
   * Track command execution
   * @param command Command name
   * @param args Command arguments
   * @param durationMs Execution duration in milliseconds
   */
  public trackCommand(command: string, args: Record<string, any> = {}, durationMs?: number): void {
    this.trackEvent(AnalyticsEventType.COMMAND_EXECUTED, {
      command,
      args,
      durationMs
    });
  }

  /**
   * Track pattern generation
   * @param pattern Pattern name
   * @param options Pattern options
   * @param stats Generation statistics
   */
  public trackPattern(pattern: string, options: Record<string, any> = {}, stats: Record<string, any> = {}): void {
    this.trackEvent(AnalyticsEventType.PATTERN_GENERATED, {
      pattern,
      options,
      stats
    });
  }

  /**
   * Track error occurrence
   * @param category Error category
   * @param message Error message
   * @param context Additional context
   */
  public trackError(category: string, message: string, context: Record<string, any> = {}): void {
    this.trackEvent(AnalyticsEventType.ERROR_OCCURRED, {
      category,
      message,
      context
    });
  }

  /**
   * Track feature usage
   * @param feature Feature name
   * @param data Feature usage data
   */
  public trackFeatureUsed(feature: string, data: Record<string, any> = {}): void {
    this.trackEvent(AnalyticsEventType.FEATURE_USED, {
      feature,
      ...data
    });
  }

  /**
   * Get personalized recommendations based on usage patterns
   * @returns Array of recommendation objects
   */
  public getRecommendations(): Array<{ title: string; description: string; command?: string; priority: number }> {
    const insights = this.getSummary();
    if (!insights) {
      return [];
    }

    const recommendations: Array<{ title: string; description: string; command?: string; priority: number }> = [];

    // Recommendation: Pattern usage
    if (insights.mostUsedPatterns.length === 0) {
      recommendations.push({
        title: 'Try different patterns',
        description: 'You haven\'t generated any patterns yet. Try the "realistic" pattern to get started.',
        command: 'graphify generate --pattern realistic',
        priority: 100
      });
    } else if (insights.mostUsedPatterns.length === 1) {
      recommendations.push({
        title: 'Explore more patterns',
        description: 'You\'ve been using only one pattern. Try exploring other patterns for different effects.',
        command: 'graphify patterns list',
        priority: 80
      });
    }

    // Recommendation: Error handling
    if (insights.errorRate > 20) {
      recommendations.push({
        title: 'Check common errors',
        description: `Your error rate is high (${insights.errorRate}%). Check our documentation for common issues.`,
        priority: 90
      });
    }

    // Recommendation: Advanced features
    if (insights.userEfficiency > 70) {
      recommendations.push({
        title: 'Try advanced features',
        description: 'You seem comfortable with Graphify. Try some advanced features like custom patterns.',
        command: 'graphify patterns create',
        priority: 70
      });
    }

    // Recommendation based on usage time
    const hourNow = DateTime.now().hour;
    if (insights.mostActiveTimeOfDay && insights.mostActiveTimeOfDay !== 'Unknown') {
      const [hourStr, period] = insights.mostActiveTimeOfDay.split(' ');
      let mostActiveHour = parseInt(hourStr);
      if (period === 'PM' && mostActiveHour !== 12) mostActiveHour += 12;
      if (period === 'AM' && mostActiveHour === 12) mostActiveHour = 0;

      if (Math.abs(hourNow - mostActiveHour) <= 2) {
        recommendations.push({
          title: 'Schedule your contributions',
          description: 'You\'re using Graphify at your most active time. Consider scheduling automated contributions.',
          command: 'graphify schedule create',
          priority: 60
        });
      }
    }

    // Sort by priority and return
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Clear all analytics data
   * @returns True if successful
   */
  public clearData(): boolean {
    try {
      if (fs.existsSync(this.eventsFile)) {
        fs.writeFileSync(this.eventsFile, JSON.stringify([]));
      }

      if (fs.existsSync(this.insightsFile)) {
        fs.writeFileSync(this.insightsFile, JSON.stringify({
          totalSessions: 0,
          activeUsageDays: 0,
          mostUsedCommands: [],
          mostUsedPatterns: [],
          averageSessionDuration: 0,
          errorRate: 0,
          userEfficiency: 50,
          lastActiveDate: '',
          mostActiveTimeOfDay: ''
        }));
      }

      return true;
    } catch (error) {
      console.error('Failed to clear analytics data:', error);
      return false;
    }
  }

  /**
   * Export analytics data to a file
   * @param filePath Path to export file
   * @returns True if successful
   */
  public exportData(filePath: string): boolean {
    try {
      const events = this.getEvents();
      const insights = this.getSummary();

      const exportData = {
        events,
        insights,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to export analytics data:', error);
      return false;
    }
  }

  /**
   * Check if analytics are enabled
   * @returns True if analytics are enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
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

  return analytics;
}

/**
 * Detect anomalies in the commit pattern
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
  if (analytics.totalCommits > 1000) {
    warnings.push('Very high commit count may look suspicious on GitHub');
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

  report += 'Generated by Graphify - GitHub Contribution Graph Generator\n';

  return report;
}

/**
 * Get HTML representation of the analytics report
 * @param analytics Analytics data
 * @returns HTML string
 */
export function generateHtmlReport(analytics: AnalyticsReport): string {
  // Create HTML report
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
    .bar-chart { width: 100%; background-color: #f1f1f1; margin-bottom: 5px; border-radius: 4px; overflow: hidden; }
    .bar { height: 30px; background-color: #0366d6; color: white; text-align: right; padding-right: 10px; line-height: 30px; border-radius: 4px; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
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
  }

  html += `</div>`;

  // Weekday distribution
  html += `
  <div class="card">
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

  html += `</div>`;

  // Time distribution
  html += `
  <div class="card">
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

  html += `
  <div class="footer">
    <p>Generated by Graphify - GitHub Contribution Graph Generator</p>
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * Get JSON representation of the analytics report
 * @param analytics Analytics data
 * @returns JSON string
 */
export function generateJsonReport(analytics: AnalyticsReport): string {
  return JSON.stringify(analytics, null, 2);
}
