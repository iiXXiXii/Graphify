import { DateTime } from 'luxon';

/**
 * Supported date input formats
 */
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

/**
 * Special date keywords that can be used in place of specific dates
 */
const SPECIAL_DATES: Record<string, () => DateTime> = {
  'yesterday': () => DateTime.now().minus({ days: 1 }),
  'today': () => DateTime.now(),
  'tomorrow': () => DateTime.now().plus({ days: 1 }),
  'last-week': () => DateTime.now().minus({ weeks: 1 }),
  'next-week': () => DateTime.now().plus({ weeks: 1 }),
  'last-month': () => DateTime.now().minus({ months: 1 }),
  'next-month': () => DateTime.now().plus({ months: 1 }),
};

/**
 * Patterns for parsing relative date expressions
 */
const RELATIVE_DATE_PATTERNS = [
  // "3 days ago", "5 weeks ago", etc.
  { regex: /^(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago$/i, direction: -1 },
  // "in 3 days", "in 2 weeks", etc.
  { regex: /^in\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/i, direction: 1 },
];

/**
 * Supported time units for relative date expressions
 */
type TimeUnit = 'day' | 'week' | 'month' | 'year';

/**
 * Validates date input and returns a standardized date string
 *
 * @param dateInput - User provided date string
 * @returns Standardized date string (ISO format)
 * @throws Error if the date format is invalid
 */
export function validateDateInput(dateInput: string): string {
  if (!dateInput || typeof dateInput !== 'string') {
    throw new Error('Date input cannot be empty and must be a string');
  }

  // Convert to lowercase for special keywords
  const lowerInput = dateInput.toLowerCase();

  // Check for special keyword dates
  if (lowerInput in SPECIAL_DATES) {
    const specialDate = SPECIAL_DATES[lowerInput as keyof typeof SPECIAL_DATES];
    if (specialDate) {
      return specialDate().toFormat('yyyy-MM-dd');
    }
    throw new Error(`Special date "${lowerInput}" exists but handler is undefined`);
  }

  // Check for relative dates (e.g., "3 days ago" or "in 2 weeks")
  for (const pattern of RELATIVE_DATE_PATTERNS) {
    const match = lowerInput.match(pattern.regex);
    if (match && match[1] && match[2]) {
      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      // Convert to singular form for Luxon
      const luxonUnit = unit.endsWith('s') ? unit.slice(0, -1) : unit;

      // Handle "in X days" vs "X days ago"
      try {
        const dt = DateTime.now().plus({
          [luxonUnit as TimeUnit]: amount * pattern.direction
        });

        if (!dt.isValid) {
          throw new Error(`Invalid date calculation: ${dt.invalidReason || 'Unknown error'}`);
        }

        return dt.toFormat('yyyy-MM-dd');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to parse relative date "${dateInput}": ${errorMessage}`);
      }
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
 *
 * @param dateStr - Standardized date string (from validateDateInput)
 * @returns JavaScript Date object
 */
export function parseDate(dateStr: string): Date {
  const dt = DateTime.fromFormat(dateStr, 'yyyy-MM-dd');

  if (!dt.isValid) {
    throw new Error(`Invalid date string: ${dateStr}. ${dt.invalidReason}`);
  }

  return dt.toJSDate();
}

/**
 * Calculates a date range for scheduling
 *
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
    const endDt = DateTime.fromJSDate(start).plus({ days });
    if (!endDt.isValid) {
      throw new Error(`Failed to calculate end date: ${endDt.invalidReason}`);
    }
    end = endDt.toJSDate();
  }

  // Validate that end date is after start date
  if (end < start) {
    throw new Error('End date must be after start date');
  }

  return { start, end };
}

/**
 * Checks if a date falls on a weekend (Saturday or Sunday)
 *
 * @param date - The date to check
 * @returns True if date is a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Checks if time is within typical business hours (9 AM - 5 PM)
 *
 * @param date - The date to check
 * @returns True if date is within business hours
 */
export function isBusinessHours(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 9 && hour <= 17; // 9 AM to 5 PM
}

/**
 * Checks if a date is during typical sleep hours (11 PM - 6 AM)
 *
 * @param date - The date to check
 * @returns True if date is during sleep hours
 */
export function isSleepHours(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 23 || hour <= 6; // 11 PM to 6 AM
}

/**
 * Checks if a date is a typically observed US holiday
 * This is a basic implementation - only checks major US holidays
 *
 * @param date - The date to check
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

  // Independence Day (July 4th)
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
 * Configuration options for date adjustments
 */
export interface DateAdjustmentOptions {
  /** Whether to avoid weekends when generating dates */
  avoidWeekends?: boolean;
  /** Whether to only generate dates during work hours */
  workHoursOnly?: boolean;
  /** Whether to avoid holiday dates */
  avoidHolidays?: boolean;
}

/**
 * Adjusts a date to appear more authentic by avoiding weekends,
 * holidays, sleep hours, etc. based on provided parameters
 *
 * @param date - The date to adjust
 * @param options - Adjustment options
 * @returns An adjusted date that appears more authentic
 */
export function adjustDateForAuthenticity(
  date: Date,
  options: DateAdjustmentOptions = {}
): Date {
  const {
    avoidWeekends = true,
    workHoursOnly = true,
    avoidHolidays = true
  } = options;

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
      // Before work, move to 9 AM + random minutes
      adjustedDate.setHours(9, Math.floor(Math.random() * 45), 0);
    } else if (hour > 17) {
      // After work, move to 4-5 PM (end of day)
      adjustedDate.setHours(16 + Math.round(Math.random()),
        Math.floor(Math.random() * 60), 0);
    }
  }

  // Avoid holidays (recursively adjust if it's a holiday)
  if (avoidHolidays && isHoliday(adjustedDate)) {
    // Move one day forward and check again (recursive)
    adjustedDate.setDate(adjustedDate.getDate() + 1);
    return adjustDateForAuthenticity(adjustedDate, options);
  }

  return adjustedDate;
}

/**
 * Parameters for date distribution
 */
export interface DateDistributionOptions extends DateAdjustmentOptions {
  /** Commit density multiplier (0.0 to 5.0, higher means more commits) */
  density?: number;
  /** 2D array pattern for weighted distribution */
  pattern?: number[][];
}

/**
 * Creates a distribution of dates within a range based on a pattern and density
 *
 * @param start - Start date
 * @param end - End date
 * @param options - Distribution options
 * @returns Array of dates
 */
export function distributeDatesInRange(
  start: Date,
  end: Date,
  options: DateDistributionOptions = {}
): Date[] {
  const { density = 0.5, pattern = [], ...adjustmentOptions } = options;
  const startDt = DateTime.fromJSDate(start);
  const endDt = DateTime.fromJSDate(end);

  // Calculate days between dates
  const days = Math.ceil(endDt.diff(startDt, 'days').days);

  if (days <= 0) {
    throw new Error('End date must be after start date');
  }

  // If there's a pattern, use it to distribute dates
  if (pattern.length > 0 && pattern[0] && pattern[0].length > 0) {
    return distributeDatesWithPattern(start, end, density, pattern, adjustmentOptions);
  }

  // Otherwise do a simple random distribution
  const dates: Date[] = [];
  const totalCommits = Math.max(1, Math.round(days * density));

  for (let i = 0; i < totalCommits; i++) {
    // Random distribution across the range
    const randomDays = Math.floor(Math.random() * days);
    const date = startDt.plus({ days: randomDays }).toJSDate();
    dates.push(adjustDateForAuthenticity(date, adjustmentOptions));
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Distributes dates based on a weight pattern
 *
 * @param start - Start date
 * @param end - End date
 * @param density - Commit density multiplier
 * @param pattern - 2D array of weights (0-5 typically)
 * @param adjustmentOptions - Options for date adjustment
 * @returns Array of dates
 */
function distributeDatesWithPattern(
  start: Date,
  end: Date,
  density: number,
  pattern: number[][],
  adjustmentOptions: DateAdjustmentOptions = {}
): Date[] {
  const startDt = DateTime.fromJSDate(start);
  const endDt = DateTime.fromJSDate(end);
  const days = Math.ceil(endDt.diff(startDt, 'days').days);

  // Calculate pattern dimensions
  const rows = pattern.length;
  // Ensure we have at least one row before accessing cols
  if (rows === 0) {
    return [];
  }

  // Ensure the first row exists before accessing its length
  const firstRow = pattern[0];
  if (!firstRow) {
    return [];
  }

  const cols = firstRow.length;
  const patternSize = rows * cols;

  // Calculate days per cell
  const daysPerCell = Math.max(1, Math.floor(days / patternSize));

  const dates: Date[] = [];

  // Map each cell in the pattern to potential commit dates
  for (let row = 0; row < rows; row++) {
    const currentRow = pattern[row];
    if (!currentRow) continue;

    for (let col = 0; col < cols; col++) {
      const cellValue = currentRow[col];
      if (cellValue === undefined || cellValue <= 0) continue; // Skip empty or undefined cells

      // Calculate base date for this cell
      const dayOffset = (row * cols + col) * daysPerCell;
      if (dayOffset >= days) continue; // Skip if we're beyond our date range

      const baseDate = startDt.plus({ days: dayOffset });

      // Number of commits based on cell intensity and density
      // Add slight randomness for more natural patterns
      const baseCommits = cellValue * density;
      const randomFactor = 0.7 + (Math.random() * 0.6); // 0.7 to 1.3 random factor
      const commitsForCell = Math.max(1, Math.round(baseCommits * randomFactor));

      // Add random commits for this cell
      for (let i = 0; i < commitsForCell; i++) {
        // Ensure commits stay within cell's day range and overall date range
        const maxOffset = Math.min(daysPerCell - 1, days - dayOffset - 1);
        if (maxOffset < 0) continue;

        const randomOffset = Math.floor(Math.random() * (maxOffset + 1));
        const date = baseDate.plus({ days: randomOffset }).toJSDate();
        dates.push(adjustDateForAuthenticity(date, adjustmentOptions));
      }
    }
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Generate a distribution of commit times that appears authentic
 *
 * @param numCommits - Number of commits to generate
 * @param startDate - Start date of the range
 * @param endDate - End date of the range
 * @param options - Date adjustment options
 * @returns An array of Date objects for commits
 */
export function generateAuthenticCommitDates(
  numCommits: number,
  startDate: Date,
  endDate: Date,
  options: DateAdjustmentOptions = {}
): Date[] {
  if (numCommits <= 0) {
    return [];
  }

  const dates: Date[] = [];
  const dateRange = endDate.getTime() - startDate.getTime();

  if (dateRange <= 0) {
    throw new Error('End date must be after start date');
  }

  // Generate random times within date range
  for (let i = 0; i < numCommits; i++) {
    const randomOffset = Math.random() * dateRange;
    const randomDate = new Date(startDate.getTime() + randomOffset);

    // Adjust for authenticity
    const adjustedDate = adjustDateForAuthenticity(randomDate, options);
    dates.push(adjustedDate);
  }

  // Sort dates chronologically
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Daily time slots for commit scheduling
 */
interface TimeSlot {
  /** Hour of day (0-23) */
  hour: number;
  /** Minute of hour (0-59) */
  minute: number;
  /** Relative likelihood of committing at this time */
  weight: number;
}

/**
 * Generate a commit schedule that follows a natural daily rhythm
 *
 * @param startDate - The start date
 * @param endDate - The end date
 * @param intensity - Number of commits per day (average)
 * @param options - Date adjustment options
 * @returns An array of scheduled dates
 */
export function generateDailyRhythmSchedule(
  startDate: Date,
  endDate: Date,
  intensity: number = 3,
  options: DateAdjustmentOptions = { avoidWeekends: true }
): Date[] {
  const dates: Date[] = [];
  const dailyPattern: TimeSlot[] = [
    { hour: 10, minute: 30, weight: 1 },    // Morning commit
    { hour: 13, minute: 15, weight: 0.7 },  // After lunch
    { hour: 16, minute: 45, weight: 1.3 }   // End of day
  ];

  let currentDate = new Date(startDate);
  const endDateValue = endDate.valueOf();

  // Iterate through each day
  while (currentDate.valueOf() <= endDateValue) {
    // Skip weekends if specified
    if (!(options.avoidWeekends && isWeekend(currentDate))) {
      // Apply daily pattern with some randomness
      dailyPattern.forEach(timeSlot => {
        // Apply intensity factor and randomness
        if (Math.random() < timeSlot.weight * (intensity / 3)) {
          const commitDate = new Date(currentDate);

          // Set hour with slight randomness
          const hourVariation = Math.floor(Math.random() * 60) - 30; // -30 to +29 minutes
          const minuteOffset = timeSlot.minute + hourVariation;

          // Handle minute overflow/underflow
          let adjustedHour = timeSlot.hour + Math.floor(minuteOffset / 60);
          const adjustedMinute = ((minuteOffset % 60) + 60) % 60; // Handle negative minutes

          commitDate.setHours(
            adjustedHour,
            adjustedMinute,
            Math.floor(Math.random() * 60) // Random seconds
          );

          // Apply authenticity adjustments
          const adjustedDate = adjustDateForAuthenticity(commitDate, options);
          dates.push(adjustedDate);
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
 *
 * @param date - The date to format
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
 *
 * @param goal - Total number of contributions desired
 * @param days - Number of days to spread contributions across
 * @returns Recommended intensity (commits per day)
 */
export function calculateCommitFrequency(goal: number, days: number): number {
  if (days <= 0) {
    throw new Error('Days must be a positive number');
  }

  // Calculate raw average
  const rawAverage = goal / days;

  // Adjust for authenticity - real developers don't commit the exact same amount every day
  // Reduce slightly to allow for natural variation in the scheduler
  return Math.min(15, Math.max(0.5, rawAverage * 0.9));
}
