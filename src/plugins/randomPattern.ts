/**
 * Random pattern generator plugin
 */
import { PatternPlugin, GraphifyConfig } from '../types/config.js';
import { getRandomInt } from '../utils/random.js';
import { ErrorHandler, ErrorCategory, GraphifyError } from '../utils/errorHandler.js';

/**
 * Implements a random distribution of commits
 */
export class RandomPatternPlugin implements PatternPlugin {
  name = 'random';
  description = 'Generates a random distribution of commits across the grid.';

  /**
   * Generate a random pattern
   * @param config Configuration to use
   * @returns Generated pattern (2D array of weeks x days)
   */
  generatePattern(config: GraphifyConfig): number[][] {
    try {
      const { maxWeeks, maxDays, commitCount } = config;

      // Create an empty grid
      const grid: number[][] = Array.from(
        { length: maxWeeks },
        () => Array(maxDays).fill(0)
      );

      // Distribute commits randomly
      let placed = 0;
      let safetyCounter = 0; // Prevent infinite loops
      const maxAttempts = commitCount * 10;

      while (placed < commitCount && safetyCounter < maxAttempts) {
        const w = getRandomInt(0, maxWeeks - 1);
        const d = getRandomInt(0, maxDays - 1);
        safetyCounter++;

        // Prefer active days if specified
        if (config.activeDays && config.activeDays.length > 0) {
          // Only place on active days
          if (!config.activeDays.includes(d)) {
            continue;
          }
        }

        // Add a commit at this position
        grid[w][d] += 1;
        placed++;
      }

      if (safetyCounter >= maxAttempts) {
        console.warn(`Warning: Could not place all commits after ${maxAttempts} attempts. Placed ${placed} of ${commitCount}.`);
      }

      return grid;
    } catch (error) {
      ErrorHandler.getInstance().handle(
        new GraphifyError(
          `Error generating random pattern: ${error instanceof Error ? error.message : String(error)}`,
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

    return config.commitCount > 0;
  }
}

export default RandomPatternPlugin;
