import { CommitPattern, GraphifyConfig } from '../../types/config';
import { randomPattern } from './random';
import { gradientPattern } from './gradient';
import { snakePattern } from './snake';
import { heartPattern } from './heart';
import { realisticPattern } from './realistic';
import { steadyPattern } from './steady';
import { crescendoPattern } from './crescendo';

/**
 * Registry of available commit patterns
 */
const patternRegistry: Record<string, CommitPattern> = {
  random: randomPattern,
  gradient: gradientPattern,
  snake: snakePattern,
  heart: heartPattern,
  realistic: realisticPattern,
  steady: steadyPattern,
  crescendo: crescendoPattern,
};

/**
 * Get a specific pattern by ID
 * @param patternId Pattern identifier
 * @returns Pattern object or undefined if not found
 */
export function getPattern(patternId: string): CommitPattern | undefined {
  return patternRegistry[patternId];
}

/**
 * Get all available patterns
 * @returns Array of all available patterns
 */
export function getCommitPatterns(): CommitPattern[] {
  return Object.values(patternRegistry);
}

/**
 * Register a new pattern
 * @param pattern Pattern to register
 * @returns True if successful, false if pattern ID already exists
 */
export function registerPattern(pattern: CommitPattern): boolean {
  if (patternRegistry[pattern.id]) {
    return false; // Pattern ID already exists
  }
  
  patternRegistry[pattern.id] = pattern;
  return true;
}

/**
 * Generate a commit distribution based on pattern and configuration
 * @param config Graphify configuration
 * @returns 2D array representing commit distribution (weeks x days)
 */
export function generateDistribution(config: GraphifyConfig): number[][] {
  // Get the requested pattern
  const pattern = getPattern(config.pattern || 'random');
  
  if (!pattern) {
    throw new Error(`Pattern "${config.pattern}" not found`);
  }
  
  // Handle custom pattern case
  if (pattern.id === 'custom' && config.customPattern) {
    return config.customPattern;
  }
  
  // Generate the pattern
  return pattern.generate(config);
}

/**
 * Apply lifecycle modifications to a distribution
 * @param distribution Original distribution
 * @param config Graphify configuration
 * @returns Modified distribution
 */
export function applyLifecycleModifications(
  distribution: number[][],
  config: GraphifyConfig
): number[][] {
  // Clone the distribution to avoid modifying the original
  const modified = distribution.map(week => [...week]);
  
  // No lifecycle simulation requested
  if (!config.projectLifecycleSimulation || config.projectLifecycleSimulation === 'none') {
    return modified;
  }
  
  // Apply different modifiers based on lifecycle type
  switch (config.projectLifecycleSimulation) {
    case 'startup':
      // More activity at the beginning, gradually decreasing
      for (let week = 0; week < modified.length; week++) {
        const factor = 1 - (week / modified.length) * 0.7; // Gradual decrease
        for (let day = 0; day < modified[week].length; day++) {
          modified[week][day] = Math.round(modified[week][day] * factor);
        }
      }
      break;
      
    case 'maintenance':
      // Low activity with occasional spikes
      for (let week = 0; week < modified.length; week++) {
        // Every 4th week has normal activity, others are reduced
        const factor = week % 4 === 0 ? 1 : 0.3;
        for (let day = 0; day < modified[week].length; day++) {
          modified[week][day] = Math.round(modified[week][day] * factor);
        }
      }
      break;
      
    case 'active-development':
      // Consistently high activity
      for (let week = 0; week < modified.length; week++) {
        for (let day = 0; day < modified[week].length; day++) {
          modified[week][day] = Math.round(modified[week][day] * 1.2);
        }
      }
      break;
  }
  
  return modified;
}

/**
 * Apply vacation periods to a distribution
 * @param distribution Original distribution
 * @param config Graphify configuration
 * @returns Modified distribution with vacation periods
 */
export function applyVacationPeriods(
  distribution: number[][],
  config: GraphifyConfig
): number[][] {
  // No vacation simulation requested
  if (!config.simulateVacations) {
    return distribution;
  }
  
  // Clone the distribution to avoid modifying the original
  const modified = distribution.map(week => [...week]);
  
  // Number of vacation periods to create
  const vacationCount = config.vacationCount || 2;
  const maxVacationLength = config.maxVacationLength || 14;
  
  // Create vacation periods
  for (let i = 0; i < vacationCount; i++) {
    // Random vacation length (3 days to maxVacationLength)
    const vacationLength = Math.floor(Math.random() * (maxVacationLength - 3)) + 3;
    
    // Random start position
    const totalDays = modified.length * 7;
    const maxStartDay = totalDays - vacationLength;
    
    if (maxStartDay <= 0) {
      continue; // Not enough days for vacation
    }
    
    const startDay = Math.floor(Math.random() * maxStartDay);
    
    // Apply vacation (zero out commits)
    for (let day = startDay; day < startDay + vacationLength; day++) {
      const weekIndex = Math.floor(day / 7);
      const dayIndex = day % 7;
      
      if (weekIndex < modified.length && dayIndex < modified[weekIndex].length) {
        modified[weekIndex][dayIndex] = 0;
      }
    }
  }
  
  return modified;
}

/**
 * Apply holiday awareness to a distribution
 * @param distribution Original distribution
 * @param config Graphify configuration
 * @param dates Array of date strings in the distribution
 * @returns Modified distribution with reduced activity on holidays
 */
export function applyHolidayAwareness(
  distribution: number[][],
  config: GraphifyConfig,
  dates: string[]
): number[][] {
  // No holiday awareness requested
  if (!config.respectHolidays) {
    return distribution;
  }
  
  // Clone the distribution to avoid modifying the original
  const modified = distribution.map(week => [...week]);
  
  // Get holidays for the selected country
  const holidays = getHolidays(config.holidayCountry || 'US', dates[0], dates[dates.length - 1]);
  
  // Reduce commits on holidays
  holidays.forEach(holiday => {
    const dateIndex = dates.indexOf(holiday.date);
    
    if (dateIndex !== -1) {
      const weekIndex = Math.floor(dateIndex / 7);
      const dayIndex = dateIndex % 7;
      
      if (weekIndex < modified.length && dayIndex < modified[weekIndex].length) {
        // Reduce commits on holidays to 20% of normal
        modified[weekIndex][dayIndex] = Math.round(modified[weekIndex][dayIndex] * 0.2);
      }
    }
  });
  
  return modified;
}

/**
 * Get holidays for a given country and date range
 * @param countryCode Country code
 * @param startDate Start date in ISO format
 * @param endDate End date in ISO format
 * @returns Array of holiday objects
 */
function getHolidays(
  countryCode: string,
  startDate: string,
  endDate: string
): Array<{ date: string; name: string }> {
  // This is a placeholder implementation
  // In a real implementation, this would fetch holidays from a service or database
  
  // Sample US holidays (simplified)
  if (countryCode === 'US') {
    return [
      { date: '2023-01-01', name: 'New Year\'s Day' },
      { date: '2023-01-16', name: 'Martin Luther King Jr. Day' },
      { date: '2023-02-20', name: 'Presidents\' Day' },
      { date: '2023-05-29', name: 'Memorial Day' },
      { date: '2023-06-19', name: 'Juneteenth' },
      { date: '2023-07-04', name: 'Independence Day' },
      { date: '2023-09-04', name: 'Labor Day' },
      { date: '2023-10-09', name: 'Columbus Day' },
      { date: '2023-11-11', name: 'Veterans Day' },
      { date: '2023-11-23', name: 'Thanksgiving Day' },
      { date: '2023-12-25', name: 'Christmas Day' },
      
      { date: '2024-01-01', name: 'New Year\'s Day' },
      { date: '2024-01-15', name: 'Martin Luther King Jr. Day' },
      { date: '2024-02-19', name: 'Presidents\' Day' },
      { date: '2024-05-27', name: 'Memorial Day' },
      { date: '2024-06-19', name: 'Juneteenth' },
      { date: '2024-07-04', name: 'Independence Day' },
      { date: '2024-09-02', name: 'Labor Day' },
      { date: '2024-10-14', name: 'Columbus Day' },
      { date: '2024-11-11', name: 'Veterans Day' },
      { date: '2024-11-28', name: 'Thanksgiving Day' },
      { date: '2024-12-25', name: 'Christmas Day' },
    ].filter(holiday => 
      holiday.date >= startDate && holiday.date <= endDate
    );
  }
  
  // For other countries, return empty array for now
  return [];
} 