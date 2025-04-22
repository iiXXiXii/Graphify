import { Plugin, PluginContext } from '../interface';
import { DateTime } from 'luxon';

/**
 * Interface for pattern generation options
 */
export interface PatternOptions {
  startDate: DateTime;
  endDate: DateTime;
  commitCount: number;
  activeDays?: number[];
  timeOfDay?: string;
}

/**
 * Interface for generated pattern data
 */
export interface PatternData {
  dates: DateTime[];
  messages: string[];
}

/**
 * Abstract base class for pattern generator plugins
 */
export abstract class BasePatternPlugin implements Plugin {
  public name: string;
  public description: string;
  public version: string = '1.0.0';

  constructor(name: string, description: string) {
    this.name = name;
    this.description = description;
  }

  /**
   * Initialize the plugin
   * @param context Plugin context
   */
  initialize(context: PluginContext): void {
    // Register the pattern generator
    context.registerPattern(this.name, this);
  }

  /**
   * Generate a pattern with dates and commit messages
   * @param options Options for pattern generation
   */
  abstract generate(options: PatternOptions): Promise<PatternData>;

  /**
   * Get a preview of the pattern
   * @param options Options for pattern generation
   */
  async getPreview(options: PatternOptions): Promise<PatternData> {
    // By default, just generate a limited version of the pattern
    const previewOptions = {
      ...options,
      commitCount: Math.min(options.commitCount, 50), // Limit commit count for preview
    };

    return this.generate(previewOptions);
  }

  /**
   * Get configuration schema for this pattern type
   */
  getConfigSchema(): Record<string, any> {
    return {};
  }

  /**
   * Validate options for this pattern
   * @param options Options to validate
   * @throws Error if options are invalid
   */
  validateOptions(options: PatternOptions): void {
    // Basic validation
    if (!options.startDate || !options.endDate) {
      throw new Error('Start and end dates are required');
    }

    if (options.endDate < options.startDate) {
      throw new Error('End date must be after start date');
    }

    if (options.commitCount <= 0) {
      throw new Error('Commit count must be greater than zero');
    }
  }

  /**
   * Generate a reasonable default commit count based on date range
   * @param startDate Start date
   * @param endDate End date
   */
  protected getDefaultCommitCount(startDate: DateTime, endDate: DateTime): number {
    const daysDiff = endDate.diff(startDate, 'days').days;
    // Average 1.5 commits per weekday
    return Math.ceil(daysDiff * 1.5 * (5 / 7));
  }

  /**
   * Generate random commit times weighted by typical development hours
   * @param date Base date
   * @param timeOfDay Time of day preference
   */
  protected generateCommitTime(date: DateTime, timeOfDay?: string): DateTime {
    let hour: number;
    let minute: number;

    // Different time distributions based on preference
    switch (timeOfDay) {
      case 'morning':
        hour = 8 + Math.floor(Math.random() * 4); // 8am-12pm
        break;
      case 'afternoon':
        hour = 13 + Math.floor(Math.random() * 5); // 1pm-5pm
        break;
      case 'evening':
        hour = 18 + Math.floor(Math.random() * 4); // 6pm-10pm
        break;
      case 'night':
        hour = (22 + Math.floor(Math.random() * 8)) % 24; // 10pm-6am
        break;
      case 'working-hours':
        hour = 9 + Math.floor(Math.random() * 9); // 9am-6pm
        break;
      case 'after-hours':
        hour = (18 + Math.floor(Math.random() * 14)) % 24; // 6pm-8am
        break;
      case 'random':
      default:
        hour = Math.floor(Math.random() * 24); // Any hour
        break;
    }

    minute = Math.floor(Math.random() * 60);

    return date.set({ hour, minute });
  }
}
