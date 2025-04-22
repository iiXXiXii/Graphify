import { DateTime } from 'luxon';
import { ErrorHandler, ErrorCategory, GraphifyError } from './errorHandler.js';

/**
 * Date utilities for Graphify
 */

/**
 * Generates a date shifted by a specified amount of time
 * @param base Base date (defaults to now)
 * @param years Years to add/subtract
 * @param months Months to add/subtract
 * @param weeks Weeks to add/subtract
 * @param days Days to add/subtract
 * @returns Formatted ISO date string
 */
export function shiftDate(
  base: DateTime = DateTime.now(),
  years: number = 0,
  months: number = 0,
  weeks: number = 0,
  days: number = 0
): string {
  try {
    const shifted = base.plus({
      years,
      months,
      weeks,
      days,
    });

    return shifted.toISO() || shifted.toString();
  } catch (error) {
    ErrorHandler.getInstance().handle(
      new GraphifyError(
        `Failed to shift date: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCategory.UNEXPECTED,
        error instanceof Error ? error : undefined
      )
    );
    // Return current time as fallback
    return DateTime.now().toISO() || DateTime.now().toString();
  }
}

/**
 * Generate a date for GitHub contribution graph
 * @param weeks Weeks to add
 * @param days Days to add
 * @param years Years to subtract (for past dates)
 * @returns Formatted ISO date string
 */
export function generateCommitDate(weeks: number, days: number, years: number = 0): string {
  return shiftDate(DateTime.now(), -years, 0, weeks, days);
}

/**
 * Returns the current date in ISO format
 * @returns Current date in ISO format
 */
export function getCurrentDate(): string {
  const now = DateTime.now();
  return now.toISO() || now.toString();
}

/**
 * Parses an ISO date string into a DateTime object
 * @param dateString The ISO date string to parse
 * @returns DateTime object
 */
export function parseDate(dateString: string): DateTime {
  const date = DateTime.fromISO(dateString);
  if (!date.isValid) {
    ErrorHandler.getInstance().handle(
      new GraphifyError(
        `Invalid date string: ${dateString}`,
        ErrorCategory.VALIDATION
      )
    );
    // Return current time as fallback
    return DateTime.now();
  }
  return date;
}

/**
 * Format a DateTime object to a user-friendly string
 * @param date DateTime object
 * @param format Format to use (defaults to ISO)
 * @returns Formatted date string
 */
export function formatDate(date: DateTime, format: string = 'ISO'): string {
  try {
    if (format === 'ISO') {
      return date.toISO() || date.toString();
    } else if (format === 'full') {
      return date.toLocaleString(DateTime.DATETIME_FULL);
    } else if (format === 'short') {
      return date.toLocaleString(DateTime.DATETIME_SHORT);
    } else if (format === 'date') {
      return date.toLocaleString(DateTime.DATE_FULL);
    } else {
      return date.toFormat(format);
    }
  } catch (error) {
    ErrorHandler.getInstance().handle(error);
    return date.toString();
  }
}

/**
 * Checks if a date is in the future
 * @param date DateTime to check
 * @returns True if the date is in the future
 */
export function isFutureDate(date: DateTime): boolean {
  return date > DateTime.now();
}

/**
 * Get date range between start and end
 * @param startDate Start date
 * @param endDate End date
 * @returns Array of DateTime objects for each day in the range
 */
export function getDateRange(startDate: DateTime, endDate: DateTime): DateTime[] {
  const result: DateTime[] = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    result.push(currentDate);
    currentDate = currentDate.plus({ days: 1 });
  }

  return result;
}
