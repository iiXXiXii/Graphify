import { DateTime } from 'luxon';
import chalk from 'chalk';

// Supported date formats
const DATE_FORMATS = [
  'yyyy-MM-dd',            // 2023-01-15
  'yyyy/MM/dd',            // 2023/01/15
  'MM/dd/yyyy',            // 01/15/2023
  'dd-MM-yyyy',            // 15-01-2023
  'MMM d, yyyy',           // Jan 15, 2023
  'MMMM d, yyyy',          // January 15, 2023
  'EEE, MMM d, yyyy',      // Sun, Jan 15, 2023
  'EEEE, MMMM d, yyyy',    // Sunday, January 15, 2023
];

// Special date keywords
const SPECIAL_DATES: Record<string, () => DateTime> = {
  'yesterday': () => DateTime.now().minus({ days: 1 }),
  'today': () => DateTime.now(),
  'tomorrow': () => DateTime.now().plus({ days: 1 }),
  'last-week': () => DateTime.now().minus({ weeks: 1 }),
  'next-week': () => DateTime.now().plus({ weeks: 1 }),
  'last-month': () => DateTime.now().minus({ months: 1 }),
  'next-month': () => DateTime.now().plus({ months: 1 }),
};

// Relative date regex patterns
const RELATIVE_DATE_PATTERNS = [
  // "3 days ago", "5 weeks ago", etc.
  { regex: /^(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago$/i, direction: -1 },
  // "in 3 days", "in 2 weeks", etc.
  { regex: /^in\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/i, direction: 1 },
];

/**
 * Validates date input and returns a standardized date string
 * @param dateInput - User provided date string
 * @returns Standardized date string (ISO format)
 * @throws Error if the date format is invalid
 */
export function validateDateInput(dateInput: string): string {
  if (!dateInput) {
    throw new Error('Date input cannot be empty');
  }

  // Convert to lowercase for special keywords
  const lowerInput = dateInput.toLowerCase();

  // Check for special keyword dates
  if (lowerInput in SPECIAL_DATES) {
    return SPECIAL_DATES[lowerInput]().toFormat('yyyy-MM-dd');
  }

  // Check for relative dates (e.g., "3 days ago" or "in 2 weeks")
  for (const pattern of RELATIVE_DATE_PATTERNS) {
    const match = lowerInput.match(pattern.regex);
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      // Convert to singular form for Luxon
      let luxonUnit = unit.endsWith('s') ? unit.slice(0, -1) : unit;

      // Handle "in X days" vs "X days ago"
      const dt = DateTime.now().plus({
        [luxonUnit as 'day' | 'week' | 'month' | 'year']: amount * pattern.direction
      });

      return dt.toFormat('yyyy-MM-dd');
    }
  }

  // Try parsing with various formats
  for (const format of DATE_FORMATS) {
    const dt = DateTime.fromFormat(dateInput, format);
    if (dt.isValid) {
      return dt.toFormat('yyyy-MM-dd');
    }
  }

  // Try ISO format as a fallback
  const dt = DateTime.fromISO(dateInput);
  if (dt.isValid) {
    return dt.toFormat('yyyy-MM-dd');
  }

  throw new Error(
    `Invalid date format: ${dateInput}. Please use a format like YYYY-MM-DD, MM/DD/YYYY, or "3 days ago".`
  );
}

/**
 * Parses a standardized date string into a Date object
 * @param dateStr - Standardized date string (from validateDateInput)
 * @returns JavaScript Date object
 */
export function parseDate(dateStr: string): Date {
  return DateTime.fromFormat(dateStr, 'yyyy-MM-dd').toJSDate();
}

/**
 * Calculates a date range for scheduling
 * @param startDate - Start date string
 * @param endDate - End date string or null
 * @param days - Number of days to include if endDate is null
 * @returns Object with start and end dates
 */
export function calculateDateRange(
  startDate: string,
  endDate: string | null = null,
  days: number = 7
): { start: Date; end: Date } {
  const start = parseDate(validateDateInput(startDate));

  let end: Date;
  if (endDate) {
    end = parseDate(validateDateInput(endDate));
  } else {
    // Default to startDate + days
    end = DateTime.fromJSDate(start).plus({ days }).toJSDate();
  }

  // Validate that end date is after start date
  if (end < start) {
    throw new Error('End date must be after start date');
  }

  return { start, end };
}

/**
 * Checks if a date is a weekend
 * @param date - Date to check
 * @returns True if the date is a Saturday or Sunday
 */
export function isWeekend(date: Date): boolean {
  const day = DateTime.fromJSDate(date).weekday;
  return day === 6 || day === 7; // Saturday is 6, Sunday is 7 in Luxon
}

/**
 * Checks if a date is within business hours (9 AM - 5 PM)
 * @param date - Date to check
 * @returns True if the date is within business hours
 */
export function isBusinessHours(date: Date): boolean {
  const hour = DateTime.fromJSDate(date).hour;
  return hour >= 9 && hour < 17;
}

/**
 * Adjusts a date to be within business hours on a weekday
 * @param date - Date to adjust
 * @param avoidWeekends - Whether to avoid weekends
 * @param businessHoursOnly - Whether to adjust to business hours
 * @returns Adjusted date
 */
export function adjustDateForAuthenticity(
  date: Date,
  avoidWeekends: boolean = true,
  businessHoursOnly: boolean = true
): Date {
  let dt = DateTime.fromJSDate(date);

  // Adjust for weekends if needed
  if (avoidWeekends && (dt.weekday === 6 || dt.weekday === 7)) {
    // Move to next Monday
    const daysToAdd = dt.weekday === 6 ? 2 : 1;
    dt = dt.plus({ days: daysToAdd });
  }

  // Adjust for business hours if needed
  if (businessHoursOnly) {
    const hour = dt.hour;
    if (hour < 9) {
      dt = dt.set({ hour: 9 + Math.floor(Math.random() * 4) }); // Between 9 AM and 1 PM
    } else if (hour >= 17) {
      dt = dt.set({ hour: 10 + Math.floor(Math.random() * 6) }); // Between 10 AM and 4 PM
      dt = dt.plus({ days: 1 }); // Move to next day

      // Check weekend again after moving to next day
      if (avoidWeekends && (dt.weekday === 6 || dt.weekday === 7)) {
        dt = dt.plus({ days: dt.weekday === 6 ? 2 : 1 });
      }
    }

    // Set random minutes
    dt = dt.set({ minute: Math.floor(Math.random() * 60) });
  }

  return dt.toJSDate();
}

/**
 * Creates a distribution of dates within a range based on a pattern and density
 * @param start - Start date
 * @param end - End date
 * @param density - Commit density (0.0 to 1.0)
 * @param pattern - Optional weight pattern
 * @returns Array of dates
 */
export function distributeDatesInRange(
  start: Date,
  end: Date,
  density: number = 0.5,
  pattern: number[][] = []
): Date[] {
  const startDt = DateTime.fromJSDate(start);
  const endDt = DateTime.fromJSDate(end);

  // Calculate days between dates
  const days = Math.ceil(endDt.diff(startDt, 'days').days);

  // If there's a pattern, use it to distribute dates
  if (pattern.length > 0 && pattern[0].length > 0) {
    return distributeDatesWithPattern(start, end, density, pattern);
  }

  // Otherwise do a simple random distribution
  const dates: Date[] = [];
  const totalCommits = Math.max(1, Math.round(days * density));

  for (let i = 0; i < totalCommits; i++) {
    // Random distribution across the range
    const randomDays = Math.floor(Math.random() * days);
    const date = startDt.plus({ days: randomDays }).toJSDate();
    dates.push(adjustDateForAuthenticity(date));
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Distributes dates based on a weight pattern
 * @param start - Start date
 * @param end - End date
 * @param density - Commit density multiplier
 * @param pattern - 2D array of weights (0-5 typically)
 * @returns Array of dates
 */
function distributeDatesWithPattern(
  start: Date,
  end: Date,
  density: number,
  pattern: number[][]
): Date[] {
  const startDt = DateTime.fromJSDate(start);
  const endDt = DateTime.fromJSDate(end);
  const days = Math.ceil(endDt.diff(startDt, 'days').days);

  // Calculate pattern dimensions
  const rows = pattern.length;
  const cols = pattern[0].length;
  const patternSize = rows * cols;

  // Calculate days per cell
  const daysPerCell = Math.max(1, Math.floor(days / patternSize));

  const dates: Date[] = [];

  // Map each cell in the pattern to potential commit dates
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellValue = pattern[row][col];
      if (cellValue <= 0) continue; // Skip empty cells

      // Calculate base date for this cell
      const dayOffset = (row * cols + col) * daysPerCell;
      const baseDate = startDt.plus({ days: dayOffset });

      // Number of commits based on cell intensity and density
      const commitsForCell = Math.max(1, Math.round(cellValue * density));

      // Add random commits for this cell
      for (let i = 0; i < commitsForCell; i++) {
        const randomOffset = Math.floor(Math.random() * daysPerCell);
        const date = baseDate.plus({ days: randomOffset }).toJSDate();
        dates.push(adjustDateForAuthenticity(date));
      }
    }
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Date utility functions for GitHub commit scheduling
 * These functions help create more natural and authentic commit patterns
 */

/**
 * Check if a date falls on a weekend (Saturday or Sunday)
 * @param date The date to check
 * @returns True if date is a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Check if time is within typical business hours (9 AM - 5 PM)
 * @param date The date to check
 * @returns True if date is within business hours
 */
export function isBusinessHours(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 9 && hour <= 17; // 9 AM to 5 PM
}

/**
 * Check if a date is during typical sleep hours (11 PM - 6 AM)
 * @param date The date to check
 * @returns True if date is during sleep hours
 */
export function isSleepHours(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 23 || hour <= 6; // 11 PM to 6 AM
}

/**
 * Checks if a date is a typically observed US holiday
 * This is a basic implementation - only checks major US holidays
 * @param date The date to check
 * @returns True if the date is a holiday
 */
export function isHoliday(date: Date): boolean {
  const month = date.getMonth(); // 0-11
  const day = date.getDate(); // 1-31

  // New Year's Day
  if (month === 0 && day === 1) return true;

  // Memorial Day (last Monday in May)
  if (month === 4) {
    // Check if it's the last Monday
    const lastDay = new Date(date.getFullYear(), 5, 0).getDate(); // Last day of May
    const lastMonday = lastDay - new Date(date.getFullYear(), 5, 0).getDay();
    if (day === lastMonday || (lastMonday < day && day <= lastDay && new Date(date.getFullYear(), 4, day).getDay() === 1)) {
      return true;
    }
  }

  // Independence Day
  if (month === 6 && day === 4) return true;

  // Labor Day (first Monday in September)
  if (month === 8) {
    const firstMonday = 1 + ((8 - new Date(date.getFullYear(), 8, 1).getDay()) % 7);
    if (day === firstMonday) return true;
  }

  // Thanksgiving (fourth Thursday in November)
  if (month === 10) {
    const firstThursday = 1 + ((4 - new Date(date.getFullYear(), 10, 1).getDay()) % 7);
    const fourthThursday = firstThursday + 21;
    if (day === fourthThursday) return true;
  }

  // Christmas
  if (month === 11 && day === 25) return true;

  return false;
}

/**
 * Adjusts a date to appear more authentic by avoiding weekends,
 * holidays, sleep hours, etc. based on provided parameters
 * @param date The date to adjust
 * @param avoidWeekends Whether to avoid weekends
 * @param workHoursOnly Whether to restrict to work hours
 * @returns An adjusted date that appears more authentic
 */
export function adjustDateForAuthenticity(
  date: Date,
  avoidWeekends: boolean = true,
  workHoursOnly: boolean = true
): Date {
  const adjustedDate = new Date(date);

  // Avoid weekends if specified
  if (avoidWeekends && isWeekend(adjustedDate)) {
    // Move to Friday or Monday
    const day = adjustedDate.getDay();
    if (day === 0) { // Sunday -> Monday
      adjustedDate.setDate(adjustedDate.getDate() + 1);
    } else { // Saturday -> Friday
      adjustedDate.setDate(adjustedDate.getDate() - 1);
    }
  }

  // Adjust time to work hours if specified
  if (workHoursOnly && !isBusinessHours(adjustedDate)) {
    const hour = adjustedDate.getHours();

    if (hour < 9) {
      // Before work, move to 9 AM
      adjustedDate.setHours(9, adjustedDate.getMinutes(), 0);
    } else if (hour > 17) {
      // After work, move to 4-5 PM (end of day)
      adjustedDate.setHours(16 + Math.round(Math.random()),
        Math.floor(Math.random() * 60), 0);
    }
  }

  // Avoid holidays (recursively adjust if it's a holiday)
  if (avoidWeekends && isHoliday(adjustedDate)) {
    // Move one day forward and check again (recursive)
    adjustedDate.setDate(adjustedDate.getDate() + 1);
    return adjustDateForAuthenticity(adjustedDate, avoidWeekends, workHoursOnly);
  }

  return adjustedDate;
}

/**
 * Generate a distribution of commit times that appears authentic
 * @param numCommits Number of commits to generate
 * @param avoidWeekends Whether to avoid weekends
 * @param workHoursOnly Whether to restrict to work hours
 * @returns An array of Date objects for commits
 */
export function generateAuthenticCommitDates(
  numCommits: number,
  startDate: Date,
  endDate: Date,
  avoidWeekends: boolean = true,
  workHoursOnly: boolean = true
): Date[] {
  const dates: Date[] = [];
  const dateRange = endDate.getTime() - startDate.getTime();

  // Generate random times within date range
  for (let i = 0; i < numCommits; i++) {
    const randomOffset = Math.random() * dateRange;
    const randomDate = new Date(startDate.getTime() + randomOffset);

    // Adjust for authenticity
    const adjustedDate = adjustDateForAuthenticity(
      randomDate, avoidWeekends, workHoursOnly
    );

    dates.push(adjustedDate);
  }

  // Sort dates chronologically
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Generate a commit schedule that follows a natural daily rhythm
 * @param startDate The start date
 * @param endDate The end date
 * @param intensity Number of commits per day (average)
 * @returns An array of scheduled dates
 */
export function generateDailyRhythmSchedule(
  startDate: Date,
  endDate: Date,
  intensity: number = 3
): Date[] {
  const dates: Date[] = [];
  const dailyPattern = [
    { hour: 10, minute: 30, weight: 1 },  // Morning commit
    { hour: 13, minute: 15, weight: 0.7 }, // After lunch
    { hour: 16, minute: 45, weight: 1.3 }  // End of day
  ];

  let currentDate = new Date(startDate);

  // Iterate through each day
  while (currentDate <= endDate) {
    // Skip weekends
    if (!isWeekend(currentDate)) {
      // Apply daily pattern with some randomness
      dailyPattern.forEach(timeSlot => {
        // Apply intensity factor and randomness
        if (Math.random() < timeSlot.weight * (intensity / 3)) {
          const commitDate = new Date(currentDate);

          // Set hour with slight randomness
          const hourVariation = Math.floor(Math.random() * 60) - 30;
          const minuteOffset = timeSlot.minute + hourVariation;

          commitDate.setHours(
            timeSlot.hour + Math.floor(minuteOffset / 60),
            minuteOffset % 60,
            Math.floor(Math.random() * 60)
          );

          dates.push(commitDate);
        }
      });
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Format a date in a human-readable format
 * @param date The date to format
 * @returns A formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
}

/**
 * Calculate a reasonable commit frequency based on a contribution goal
 * @param goal Total number of contributions desired
 * @param days Number of days to spread contributions across
 * @returns Recommended intensity (commits per day)
 */
export function calculateCommitFrequency(goal: number, days: number): number {
  // Calculate raw average
  const rawAverage = goal / days;

  // Adjust for authenticity - real developers don't commit the exact same amount every day
  // Reduce slightly to allow for natural variation in the scheduler
  return Math.min(15, Math.max(0.5, rawAverage * 0.9));
}
