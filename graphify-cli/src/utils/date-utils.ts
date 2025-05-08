import { DateTime } from 'luxon';

// Define valid time units for better type safety
type TimeUnit = 'day' | 'week' | 'month' | 'year';

/**
 * Validates date input and returns a standardized date string
 */
export function validateDateInput(dateInput: string): Date {
  if (!dateInput) {
    throw new Error('Date input cannot be empty');
  }

  // Convert to lowercase for special keywords
  const lowerInput = dateInput.toLowerCase();

  // Check for special keyword dates
  if (lowerInput === 'yesterday') {
    return DateTime.now().minus({ days: 1 }).toJSDate();
  } else if (lowerInput === 'today') {
    return DateTime.now().toJSDate();
  } else if (lowerInput === 'tomorrow') {
    return DateTime.now().plus({ days: 1 }).toJSDate();
  } else if (lowerInput === 'last-week') {
    return DateTime.now().minus({ weeks: 1 }).toJSDate();
  } else if (lowerInput === 'next-week') {
    return DateTime.now().plus({ weeks: 1 }).toJSDate();
  } else if (lowerInput === 'last-month') {
    return DateTime.now().minus({ months: 1 }).toJSDate();
  } else if (lowerInput === 'next-month') {
    return DateTime.now().plus({ months: 1 }).toJSDate();
  }

  // Check for relative dates (e.g., "3 days ago" or "in 2 weeks")
  const relPatterns = [
    { regex: /^(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago$/i, direction: -1 },
    { regex: /^in\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/i, direction: 1 },
  ];

  for (const pattern of relPatterns) {
    const match = lowerInput.match(pattern.regex);
    if (match && match[1] && match[2]) {
      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      // Convert to singular form for Luxon and ensure type safety
      let luxonUnit: TimeUnit = 'day'; // Default

      if (unit.startsWith('day')) luxonUnit = 'day';
      else if (unit.startsWith('week')) luxonUnit = 'week';
      else if (unit.startsWith('month')) luxonUnit = 'month';
      else if (unit.startsWith('year')) luxonUnit = 'year';

      // Create a properly typed object for DateTime.plus/minus
      const durationObj: Record<TimeUnit, number> = {
        day: 0,
        week: 0,
        month: 0,
        year: 0
      };
      durationObj[luxonUnit] = amount * pattern.direction;

      // Handle "in X days" vs "X days ago"
      const dt = DateTime.now().plus(durationObj);
      return dt.toJSDate();
    }
  }

  // Try parsing with various formats
  const formats = [
    'yyyy-MM-dd',            // 2023-01-15
    'yyyy/MM/dd',            // 2023/01/15
    'MM/dd/yyyy',            // 01/15/2023
    'dd-MM-yyyy',            // 15-01-2023
    'MMM d, yyyy',           // Jan 15, 2023
    'MMMM d, yyyy',          // January 15, 2023
    'EEE, MMM d, yyyy',      // Sun, Jan 15, 2023
    'EEEE, MMMM d, yyyy',    // Sunday, January 15, 2023
  ];

  for (const format of formats) {
    const dt = DateTime.fromFormat(dateInput, format);
    if (dt.isValid) {
      return dt.toJSDate();
    }
  }

  // Try ISO format as a fallback
  const dt = DateTime.fromISO(dateInput);
  if (dt.isValid) {
    return dt.toJSDate();
  }

  throw new Error(
    `Invalid date format: ${dateInput}. Please use a format like YYYY-MM-DD, MM/DD/YYYY, or "3 days ago".`
  );
}

/**
 * Formats a date in a human-readable format
 */
export function formatDate(date: Date): string {
  return DateTime.fromJSDate(date).toFormat('ccc, MMM d, yyyy');
}

/**
 * Creates a date range between two dates
 */
export function createDateRange(start: Date, end: Date): Date[] {
  const startDt = DateTime.fromJSDate(start);
  const endDt = DateTime.fromJSDate(end);

  // Calculate days between dates
  const days = Math.ceil(endDt.diff(startDt, 'days').days);

  // Generate array of dates
  const dates: Date[] = [];
  for (let i = 0; i <= days; i++) {
    dates.push(startDt.plus({ days: i }).toJSDate());
  }

  return dates;
}

/**
 * Check if a date falls on a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  const dt = DateTime.fromJSDate(date);
  return dt.weekday >= 6; // Saturday (6) or Sunday (7) in Luxon
}

/**
 * Check if time is within typical business hours (9 AM - 5 PM)
 */
export function isBusinessHours(date: Date): boolean {
  const dt = DateTime.fromJSDate(date);
  return dt.hour >= 9 && dt.hour < 17; // 9 AM to 5 PM
}

/**
 * Adjusts a date to appear more authentic by avoiding weekends,
 * holidays, sleep hours, etc. based on provided parameters
 */
export function adjustDateForAuthenticity(
  date: Date,
  avoidWeekends: boolean = true,
  workHoursOnly: boolean = true
): Date {
  if (!date) {
    throw new Error('Date cannot be null or undefined');
  }

  const dt = DateTime.fromJSDate(date);
  let adjusted = dt;

  // Avoid weekends if specified
  if (avoidWeekends && dt.weekday >= 6) { // 6 = Saturday, 7 = Sunday in Luxon
    if (dt.weekday === 6) { // Saturday -> Friday
      adjusted = adjusted.minus({ days: 1 });
    } else { // Sunday -> Monday
      adjusted = adjusted.plus({ days: 1 });
    }
  }

  // Adjust time to work hours if specified
  if (workHoursOnly) {
    const hour = adjusted.hour;

    if (hour < 9) {
      // Before work hours -> move to 9-11 AM
      adjusted = adjusted.set({
        hour: 9 + Math.floor(Math.random() * 2),
        minute: Math.floor(Math.random() * 60)
      });
    } else if (hour >= 17) {
      // After work hours -> move to 2-5 PM
      adjusted = adjusted.set({
        hour: 14 + Math.floor(Math.random() * 3),
        minute: Math.floor(Math.random() * 60)
      });
    }
  }

  return adjusted.toJSDate();
}

/**
 * Generate random commit times for a specific day
 */
export function generateRandomCommitTimes(
  baseDate: Date,
  count: number,
  workHoursOnly: boolean = true
): DateTime[] {
  if (!baseDate) {
    throw new Error('Base date cannot be null or undefined');
  }

  if (count < 0) {
    throw new Error('Count must be a non-negative number');
  }

  const result: DateTime[] = [];
  const baseDt = DateTime.fromJSDate(baseDate);

  for (let i = 0; i < count; i++) {
    let hour: number;

    if (workHoursOnly) {
      // Business hours (9 AM - 5 PM)
      hour = 9 + Math.floor(Math.random() * 8);
    } else {
      // Any time, but weighted toward working hours
      if (Math.random() < 0.7) {
        // 70% chance of business hours
        hour = 9 + Math.floor(Math.random() * 8);
      } else {
        // 30% chance of non-business hours
        hour = Math.floor(Math.random() * 24);
      }
    }

    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);

    const commitTime = baseDt.set({
      hour,
      minute,
      second
    });

    result.push(commitTime);
  }

  // Sort by time
  return result.sort((a, b) => a.toMillis() - b.toMillis());
}
