import { BasePatternPlugin, PatternData, PatternOptions } from './basePatternPlugin';
import { DateTime } from 'luxon';
import { getRandomCommitMessage } from '../../utils/commitMessages';

/**
 * A plugin that generates random commit patterns
 */
export class RandomPatternPlugin extends BasePatternPlugin {
  constructor() {
    super('random', 'Generates commits with random distribution across the date range');
  }

  /**
   * Generate randomly distributed commit dates
   * @param options The pattern generation options
   * @returns Generated pattern data
   */
  async generate(options: PatternOptions): Promise<PatternData> {
    this.validateOptions(options);

    const { startDate, endDate, commitCount, activeDays = [0, 1, 2, 3, 4, 5, 6], timeOfDay } = options;

    // Calculate total available days considering active days filter
    const totalDays = Math.ceil(endDate.diff(startDate, 'days').days);
    const dates: DateTime[] = [];
    const messages: string[] = [];

    // Generate random dates within the range
    for (let i = 0; i < commitCount; i++) {
      let randomDate: DateTime;
      let attempts = 0;
      let valid = false;

      // Try to find a valid date (respecting active days)
      while (!valid && attempts < 100) {
        // Random day within range
        const randomDayOffset = Math.floor(Math.random() * totalDays);
        randomDate = startDate.plus({ days: randomDayOffset });

        // Check if this is an active day of week
        const dayOfWeek = randomDate.weekday % 7; // 0 = Sunday, 6 = Saturday
        if (activeDays.includes(dayOfWeek)) {
          valid = true;
        } else {
          attempts++;
        }
      }

      // If we couldn't find a valid day after 100 attempts, use any day
      if (!valid) {
        const randomDayOffset = Math.floor(Math.random() * totalDays);
        randomDate = startDate.plus({ days: randomDayOffset });
      }

      // Add time component to the date
      randomDate = this.generateCommitTime(randomDate, timeOfDay);

      dates.push(randomDate);
      messages.push(getRandomCommitMessage());
    }

    // Sort dates chronologically
    const sortedIndices = dates.map((date, index) => ({ date, index }))
      .sort((a, b) => a.date.toMillis() - b.date.toMillis())
      .map(item => item.index);

    const sortedDates = sortedIndices.map(index => dates[index]);
    const sortedMessages = sortedIndices.map(index => messages[index]);

    return {
      dates: sortedDates,
      messages: sortedMessages,
    };
  }

  /**
   * Get configuration schema specific to random pattern
   */
  getConfigSchema(): Record<string, any> {
    return {
      distribution: {
        type: 'string',
        enum: ['uniform', 'weekday-weighted', 'working-hours'],
        default: 'uniform',
        description: 'Distribution pattern for random commits'
      },
      variance: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        default: 0.5,
        description: 'How much variance in the randomness (0 = perfectly uniform, 1 = very random)'
      }
    };
  }
}
