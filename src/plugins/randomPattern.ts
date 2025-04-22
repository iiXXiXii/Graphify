/**
 * Random pattern generator plugin
 */
import { PatternPlugin, GraphifyConfig } from '../types/config.js';

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
    const { maxWeeks, maxDays, commitCount } = config;

    // Create an empty grid
    const grid: number[][] = Array.from(
      { length: maxWeeks },
      () => Array(maxDays).fill(0)
    );

    // Distribute commits randomly
    let placed = 0;
    while (placed < commitCount) {
      const w = Math.floor(Math.random() * maxWeeks);
      const d = Math.floor(Math.random() * maxDays);

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

    return grid;
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
