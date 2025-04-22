/**
 * Realistic pattern generator plugin
 */
import { PatternPlugin, GraphifyConfig } from '../types/config.js';
import { getRandomInt } from '../utils/random.js';
import { TimeUtils } from '../utils/timeUtils.js';
import { ErrorHandler, ErrorCategory, GraphifyError } from '../utils/errorHandler.js';
import { DateTime } from 'luxon';

/**
 * Implements a realistic distribution of commits that simulates typical developer activity
 */
export class RealisticPatternPlugin implements PatternPlugin {
  name = 'realistic';
  description = 'Generates a realistic distribution with focus on weekdays and holidays.';

  /**
   * Generate a realistic pattern
   * @param config Configuration to use
   * @returns Generated pattern (2D array of weeks x days)
   */
  generatePattern(config: GraphifyConfig): number[][] {
    try {
      const { maxWeeks, maxDays, commitCount, activeDays = [1, 2, 3, 4, 5] } = config;

      // Create an empty grid
      const grid: number[][] = Array.from(
        { length: maxWeeks },
        () => Array(maxDays).fill(0)
      );

      // Create a more realistic distribution based on:
      // 1. Day of week (more on weekdays)
      // 2. Time of day (more during working hours)
      // 3. Development cycles if enabled

      // Generate development cycle if enabled
      const useCycles = config.simulateDevelopmentCycles === true;
      const cycleLength = config.developmentCycleLength || 14; // Default 2-week sprints
      const cycleStart = DateTime.now().minus({ days: 30 });

      // Set up vacation periods if enabled
      const vacationPeriods: Array<[DateTime, DateTime]> = [];
      if (config.simulateVacations) {
        const vacationCount = config.vacationCount || 2;
        const maxVacationLength = config.maxVacationLength || 14;

        // Generate fake vacation periods (not actual dates, just for weight calculation)
        const startDate = DateTime.now().minus({ days: maxWeeks * 7 });
        const endDate = DateTime.now();

        TimeUtils.generateVacationPeriods(
          startDate,
          endDate,
          vacationCount,
          maxVacationLength
        ).forEach(period => vacationPeriods.push(period));
      }

      // Distribute commits by weighted probability
      let placed = 0;
      let availablePositions: { week: number; day: number; weight: number }[] = [];

      // Calculate weight for each position
      for (let w = 0; w < maxWeeks; w++) {
        for (let d = 0; d < maxDays; d++) {
          // Skip non-active days
          if (!activeDays.includes(d)) {
            continue;
          }

          // Base weight
          let weight = 1.0;

          // Increase weight for weekdays (Mon-Fri)
          if (d >= 1 && d <= 5) {
            weight *= 1.5;
          }

          // Apply development cycle weight if enabled
          if (useCycles) {
            // Simulate a date for this grid position
            const simulatedDate = DateTime.now().minus({ days: (w * 7) + (6 - d) });
            weight *= TimeUtils.getDevelopmentCycleWeight(simulatedDate, cycleStart, cycleLength);
          }

          // Simulate vacations - greatly reduce weight during vacation periods
          if (config.simulateVacations && vacationPeriods.length > 0) {
            const simulatedDate = DateTime.now().minus({ days: (w * 7) + (6 - d) });

            if (TimeUtils.isVacation(simulatedDate, vacationPeriods)) {
              weight *= 0.1; // 90% reduction during vacations
            }
          }

          // Simulate holidays - reduce weight on holidays
          if (config.respectHolidays) {
            const simulatedDate = DateTime.now().minus({ days: (w * 7) + (6 - d) });

            if (TimeUtils.isHoliday(simulatedDate, config.holidayCountry)) {
              weight *= 0.3; // 70% reduction on holidays
            }
          }

          // Project lifecycle simulation if enabled
          if (config.projectLifecycleSimulation !== 'none') {
            const progress = w / maxWeeks; // 0 at start, 1 at end of timeline

            switch (config.projectLifecycleSimulation) {
              case 'startup':
                // More activity at beginning
                weight *= 1.5 - progress;
                break;
              case 'maintenance':
                // Low activity with occasional spikes
                weight *= 0.5 + (Math.sin(progress * 10) * 0.25);
                break;
              case 'active-development':
                // Consistent high activity with occasional peaks
                weight *= 0.8 + (Math.sin(progress * 5) * 0.4);
                break;
            }
          }

          availablePositions.push({ week: w, day: d, weight });
        }
      }

      // Sort positions by weight (highest first)
      availablePositions.sort((a, b) => b.weight - a.weight);

      // Calculate total weight
      const totalWeight = availablePositions.reduce((sum, pos) => sum + pos.weight, 0);

      // If no valid positions found, return empty pattern
      if (availablePositions.length === 0 || totalWeight === 0) {
        console.warn('No valid positions for realistic pattern.');
        return grid;
      }

      // Place commits based on weighted probability
      while (placed < commitCount && availablePositions.length > 0) {
        // Select a position based on weight
        const rand = Math.random() * totalWeight;
        let runningTotal = 0;
        let selectedIndex = -1;

        for (let i = 0; i < availablePositions.length; i++) {
          runningTotal += availablePositions[i].weight;
          if (rand <= runningTotal) {
            selectedIndex = i;
            break;
          }
        }

        // Fallback if selection fails
        if (selectedIndex === -1) {
          selectedIndex = 0;
        }

        const { week, day } = availablePositions[selectedIndex];

        // Add commit at this position (can have multiple)
        const commitFrequency = config.commitFrequency || 1;
        const count = Math.max(1, Math.round(commitFrequency * Math.random() * 1.5));
        grid[week][day] += Math.min(count, commitCount - placed);

        // Update placed count
        placed += Math.min(count, commitCount - placed);

        // Remove this position and recalculate total weight
        availablePositions.splice(selectedIndex, 1);

        // Recalculate total weight
        if (availablePositions.length > 0) {
          const newTotalWeight = availablePositions.reduce((sum, pos) => sum + pos.weight, 0);

          // If no weight left, break out
          if (newTotalWeight <= 0) {
            break;
          }
        }
      }

      return grid;
    } catch (error) {
      ErrorHandler.getInstance().handle(
        new GraphifyError(
          `Error generating realistic pattern: ${error instanceof Error ? error.message : String(error)}`,
          ErrorCategory.PATTERN,
          error instanceof Error ? error : undefined
        )
      );

      // Return a minimal grid as fallback
      return [[1]];
    }
  }

  /**
   * Validate configuration for this pattern
   * @param config Configuration to validate
   * @returns Whether the configuration is valid
   */
  validate(config: GraphifyConfig): boolean {
    if (!config.maxWeeks || !config.maxDays || !config.commitCount) {
      return false;
    }

    if (!Array.isArray(config.activeDays)) {
      return false;
    }

    return config.commitCount > 0;
  }
}

export default RealisticPatternPlugin;
