import { DateTime } from 'luxon';

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
  const shifted = base.plus({
    years,
    months,
    weeks,
    days,
  });
  
  return shifted.toISO() || shifted.toString();
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
  return DateTime.fromISO(dateString);
} 