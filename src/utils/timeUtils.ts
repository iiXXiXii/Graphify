import { DateTime } from 'luxon';
import { TimeOfDayPreference } from '../config/default';
import { getRandomInt } from './random';

/**
 * Time utilities for generating realistic timestamps
 */
export class TimeUtils {
  /**
   * Get a random time of day based on preference
   * @param preference Time of day preference
   * @returns Hour (0-23) and minute
   */
  static getRandomTimeOfDay(preference: TimeOfDayPreference = 'working-hours'): { hour: number, minute: number } {
    let hour: number;
    const minute = getRandomInt(0, 59);
    
    switch (preference) {
      case 'morning':
        hour = getRandomInt(8, 11);
        break;
      case 'afternoon':
        hour = getRandomInt(13, 17);
        break;
      case 'evening':
        hour = getRandomInt(18, 21);
        break;
      case 'night':
        hour = getRandomInt(22, 23);
        break;
      case 'working-hours':
        hour = getRandomInt(9, 17);
        break;
      case 'after-hours':
        hour = Math.random() > 0.5 
          ? getRandomInt(18, 23) 
          : getRandomInt(0, 7);
        break;
      case 'random':
      default:
        hour = getRandomInt(0, 23);
        break;
    }
    
    return { hour, minute };
  }

  /**
   * Add random time variance to a date
   * @param baseDate Base date
   * @param preference Time preference
   * @param minTimeBetween Minimum time between commits (in minutes)
   * @param lastCommitTime Optional previous commit time to respect minimum time between
   * @returns Date with random time applied
   */
  static applyTimeVariance(
    baseDate: DateTime,
    preference: TimeOfDayPreference = 'working-hours',
    minTimeBetween: number = 30,
    lastCommitTime?: DateTime
  ): DateTime {
    // Get random time
    const { hour, minute } = this.getRandomTimeOfDay(preference);
    
    // Create a new date with the random time
    let result = baseDate.set({ hour, minute, second: getRandomInt(0, 59) });
    
    // If there was a previous commit time on the same day, ensure minimum time between
    if (lastCommitTime && lastCommitTime.hasSame(result, 'day')) {
      const minDiff = lastCommitTime.diff(result, 'minutes').minutes;
      
      if (Math.abs(minDiff) < minTimeBetween) {
        // Add minimum time to previous commit
        result = lastCommitTime.plus({ minutes: minTimeBetween + getRandomInt(1, 30) });
        
        // If this pushes us to the next day, adjust back
        if (!result.hasSame(baseDate, 'day')) {
          result = baseDate.set({ hour: 23, minute: getRandomInt(30, 59) });
        }
      }
    }
    
    return result;
  }

  /**
   * Checks if a date falls on a common holiday
   * @param date Date to check
   * @param country Country code (defaults to US)
   * @returns True if the date is a holiday
   */
  static isHoliday(date: DateTime, country: string = 'US'): boolean {
    // Simple implementation for common US holidays
    // Could be expanded to use a proper holiday calendar library
    const month = date.month;
    const day = date.day;
    const dayOfWeek = date.weekday;
    
    // Check for common US holidays
    if (country === 'US') {
      // New Year's Day
      if (month === 1 && day === 1) return true;
      
      // Memorial Day (last Monday in May)
      if (month === 5 && dayOfWeek === 1 && date.endOf('month').diff(date, 'days').days < 7) return true;
      
      // Independence Day
      if (month === 7 && day === 4) return true;
      
      // Labor Day (first Monday in September)
      if (month === 9 && dayOfWeek === 1 && day <= 7) return true;
      
      // Thanksgiving (fourth Thursday in November)
      if (month === 11 && dayOfWeek === 4 && day > 21 && day < 29) return true;
      
      // Christmas
      if (month === 12 && day === 25) return true;
    }
    
    return false;
  }

  /**
   * Generate vacation periods (periods with no commits)
   * @param startDate Start date of overall range
   * @param endDate End date of overall range
   * @param count Number of vacation periods
   * @param maxLength Maximum length of a vacation in days
   * @returns Array of vacation periods [start, end]
   */
  static generateVacationPeriods(
    startDate: DateTime,
    endDate: DateTime,
    count: number = 2,
    maxLength: number = 14
  ): Array<[DateTime, DateTime]> {
    const vacations: Array<[DateTime, DateTime]> = [];
    const totalDays = endDate.diff(startDate, 'days').days;
    
    // Don't generate vacations for short periods
    if (totalDays < 30) {
      return vacations;
    }
    
    // Generate vacation periods
    for (let i = 0; i < count; i++) {
      // Random start date between startDate and 14 days before endDate
      const daysOffset = getRandomInt(10, totalDays - maxLength - 5);
      const vacationStart = startDate.plus({ days: daysOffset });
      
      // Random length between 3 and maxLength
      const vacationLength = getRandomInt(3, maxLength);
      const vacationEnd = vacationStart.plus({ days: vacationLength });
      
      // Add to list
      vacations.push([vacationStart, vacationEnd]);
    }
    
    return vacations;
  }

  /**
   * Check if a date falls within any vacation period
   * @param date Date to check
   * @param vacationPeriods Array of vacation periods [start, end]
   * @returns True if date is during a vacation
   */
  static isVacation(date: DateTime, vacationPeriods: Array<[DateTime, DateTime]>): boolean {
    for (const [start, end] of vacationPeriods) {
      if (date >= start && date <= end) {
        return true;
      }
    }
    return false;
  }

  /**
   * Apply development cycle weighting to commit frequency
   * @param date Date to check
   * @param cycleStart Start date of the development cycle
   * @param cycleLength Length of cycle in days
   * @returns Weight factor (0.5 to 1.5)
   */
  static getDevelopmentCycleWeight(
    date: DateTime,
    cycleStart: DateTime,
    cycleLength: number = 14
  ): number {
    // Calculate day within cycle
    const daysSinceCycleStart = date.diff(cycleStart, 'days').days;
    const dayInCycle = daysSinceCycleStart % cycleLength;
    const cyclePosition = dayInCycle / cycleLength;
    
    // Weight based on position in cycle
    // Beginning: Planning phase (fewer commits)
    // Middle: Implementation phase (more commits)
    // End: Testing/release phase (medium commits)
    if (cyclePosition < 0.2) {
      // Planning phase - fewer commits
      return 0.5 + cyclePosition;
    } else if (cyclePosition < 0.8) {
      // Implementation phase - more commits
      return 1.0 + 0.5 * Math.sin((cyclePosition - 0.2) * Math.PI / 0.6);
    } else {
      // Testing/release phase - tapering off
      return 1.0 - (cyclePosition - 0.8) * 2;
    }
  }
} 