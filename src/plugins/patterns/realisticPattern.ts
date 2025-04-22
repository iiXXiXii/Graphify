import { BasePatternPlugin, PatternData, PatternOptions } from './basePatternPlugin';
import { DateTime } from 'luxon';
import { getRandomCommitMessage } from '../../utils/commitMessages';

/**
 * Options specific to realistic pattern generation
 */
interface RealisticPatternOptions extends PatternOptions {
  simulateVacations?: boolean;
  respectHolidays?: boolean;
  simulateDevelopmentCycles?: boolean;
}

/**
 * A plugin that generates realistic commit patterns matching typical developer activity
 */
export class RealisticPatternPlugin extends BasePatternPlugin {
  // Common holidays - month and day
  private holidays = [
    { month: 1, day: 1 },   // New Year's Day
    { month: 12, day: 25 }, // Christmas
    { month: 7, day: 4 },   // Independence Day (US)
    { month: 11, day: 11 }, // Veterans Day (US) / Remembrance Day
    { month: 5, day: 31 },  // Memorial Day placeholder (last Monday in May)
    { month: 9, day: 1 },   // Labor Day placeholder (first Monday in September)
  ];

  constructor() {
    super('realistic', 'Generates commits that simulate typical developer activity');
  }

  /**
   * Generate a realistic commit pattern
   * @param options The pattern generation options
   * @returns Generated pattern data
   */
  async generate(options: RealisticPatternOptions): Promise<PatternData> {
    this.validateOptions(options);

    const {
      startDate,
      endDate,
      commitCount,
      activeDays = [1, 2, 3, 4, 5], // Default to weekdays only
      timeOfDay = 'working-hours',
      simulateVacations = false,
      respectHolidays = false,
      simulateDevelopmentCycles = false
    } = options;

    // Create a probability map for each day in the range
    const totalDays = Math.ceil(endDate.diff(startDate, 'days').days) + 1;
    const probabilityMap = new Array(totalDays).fill(1);
    let currentDate = startDate.startOf('day');

    // Apply realistic patterns to the probability map
    for (let i = 0; i < totalDays; i++) {
      const dayOfWeek = currentDate.weekday;

      // Weekday vs weekend weighting
      if (dayOfWeek === 6) { // Saturday
        probabilityMap[i] *= 0.3;
      } else if (dayOfWeek === 7) { // Sunday
        probabilityMap[i] *= 0.2;
      } else {
        // Normal weekday
        // More commits on Tuesday-Thursday, fewer on Monday/Friday
        if (dayOfWeek === 1) probabilityMap[i] *= 0.7; // Monday
        if (dayOfWeek === 5) probabilityMap[i] *= 0.8; // Friday
      }

      // Filter out non-active days
      if (!activeDays.includes((dayOfWeek % 7))) {
        probabilityMap[i] = 0;
      }

      // Apply holiday weighting
      if (respectHolidays && this.isHoliday(currentDate)) {
        probabilityMap[i] *= 0.1;
      }

      // Apply vacation simulation
      if (simulateVacations && this.shouldBeVacation(i, totalDays)) {
        probabilityMap[i] *= 0.05;
      }

      // Apply development cycle simulation
      if (simulateDevelopmentCycles) {
        const cycleModifier = this.getDevelopmentCycleModifier(i, totalDays);
        probabilityMap[i] *= cycleModifier;
      }

      currentDate = currentDate.plus({ days: 1 });
    }

    // Normalize the probability map
    const totalProbability = probabilityMap.reduce((sum, p) => sum + p, 0);
    const normalizedMap = probabilityMap.map(p => p / totalProbability);

    // Generate dates based on probability map
    const dates: DateTime[] = [];
    const messages: string[] = [];

    for (let i = 0; i < commitCount; i++) {
      // Choose a day based on probability
      const rand = Math.random();
      let cumulativeProbability = 0;
      let chosenDayIndex = -1;

      for (let j = 0; j < normalizedMap.length; j++) {
        cumulativeProbability += normalizedMap[j];
        if (rand <= cumulativeProbability) {
          chosenDayIndex = j;
          break;
        }
      }

      // If we didn't find a day (unlikely with normalized probabilities), pick a random one
      if (chosenDayIndex === -1) {
        chosenDayIndex = Math.floor(Math.random() * totalDays);
      }

      // Create date from chosen day
      const commitDate = startDate.plus({ days: chosenDayIndex });

      // Add time component typical for developers
      const finalDate = this.generateRealisticCommitTime(commitDate, timeOfDay);

      dates.push(finalDate);
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
   * Check if a date is a common holiday
   * @param date Date to check
   * @returns Whether the date is a holiday
   */
  private isHoliday(date: DateTime): boolean {
    const month = date.month;
    const day = date.day;

    return this.holidays.some(h => h.month === month && h.day === day);
  }

  /**
   * Determine if a day should be part of a simulated vacation
   * @param dayIndex Index of the day in the range
   * @param totalDays Total days in the range
   * @returns Whether the day should be a vacation day
   */
  private shouldBeVacation(dayIndex: number, totalDays: number): boolean {
    // Simulate 2-3 vacation periods per year
    const daysPerYear = 365;
    const vacationsPerYear = 2 + Math.floor(Math.random() * 2);
    const vacationDuration = 5 + Math.floor(Math.random() * 10); // 5-14 day vacations

    // Scale to the actual time range
    const yearsInRange = totalDays / daysPerYear;
    const totalVacations = Math.ceil(vacationsPerYear * yearsInRange);

    // Generate vacation periods
    for (let i = 0; i < totalVacations; i++) {
      const vacationStart = Math.floor(Math.random() * totalDays);
      if (dayIndex >= vacationStart && dayIndex < vacationStart + vacationDuration) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate development cycle modifier for a given day
   * @param dayIndex Index of the day in the range
   * @param totalDays Total days in the range
   * @returns A probability modifier for the day
   */
  private getDevelopmentCycleModifier(dayIndex: number, totalDays: number): number {
    // Simulate 2-week sprints with more commits near the end of each sprint
    const sprintLength = 14; // 2 weeks
    const dayInSprint = dayIndex % sprintLength;

    if (dayInSprint < sprintLength / 2) {
      // First half of sprint: planning, design, initial coding
      return 0.7 + (dayInSprint / (sprintLength / 2)) * 0.6;
    } else {
      // Second half of sprint: coding, testing, bug fixing, release prep
      return 1.3;
    }
  }

  /**
   * Generate a realistic commit time based on actual developer habits
   * @param date Base date
   * @param timeOfDayPreference User preference for time of day
   */
  private generateRealisticCommitTime(date: DateTime, timeOfDayPreference?: string): DateTime {
    // If user has no preference, use realistic developer patterns
    if (!timeOfDayPreference || timeOfDayPreference === 'realistic') {
      const hour = this.getRealisticHourDistribution();
      const minute = Math.floor(Math.random() * 60);
      return date.set({ hour, minute });
    }

    // Otherwise use the base implementation
    return this.generateCommitTime(date, timeOfDayPreference);
  }

  /**
   * Get an hour based on realistic developer commit patterns
   * Higher probability during working hours, peaks around 10-11am and 2-4pm
   * @returns An hour of the day (0-23)
   */
  private getRealisticHourDistribution(): number {
    // Probabilities for each hour, higher values = more likely
    const hourDistribution = [
      1,  // 12am
      0.5,
      0.2,
      0.1,
      0.1,
      0.2,
      0.5, // 6am
      2,
      5,
      8,
      10, // 10am
      9,
      5,
      7,
      9,
      10, // 3pm
      8,
      5,
      3,
      2,  // 7pm
      1.5,
      1,
      1,
      1   // 11pm
    ];

    const totalProbability = hourDistribution.reduce((sum, p) => sum + p, 0);
    const normalizedDistribution = hourDistribution.map(p => p / totalProbability);

    // Pick an hour based on probability
    const rand = Math.random();
    let cumulativeProbability = 0;

    for (let hour = 0; hour < 24; hour++) {
      cumulativeProbability += normalizedDistribution[hour];
      if (rand <= cumulativeProbability) {
        return hour;
      }
    }

    // Fallback
    return 14; // 2pm
  }

  /**
   * Get configuration schema specific to realistic pattern
   */
  getConfigSchema(): Record<string, any> {
    return {
      simulateVacations: {
        type: 'boolean',
        default: false,
        description: 'Simulate vacation periods with no commits'
      },
      respectHolidays: {
        type: 'boolean',
        default: false,
        description: 'Reduce commit frequency on common holidays'
      },
      simulateDevelopmentCycles: {
        type: 'boolean',
        default: false,
        description: 'Simulate development cycles with varying commit activity'
      }
    };
  }
}
