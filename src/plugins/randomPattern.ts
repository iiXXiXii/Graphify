import type { PatternPlugin } from './interface.js';
import type { GraphifyConfig } from '../types/config.js';

export class RandomPatternPlugin implements PatternPlugin {
  name = 'random';
  description = 'Generates a random distribution of commits across the grid.';

  generatePattern(config: GraphifyConfig): number[][] {
    const { maxWeeks, maxDays, commitCount } = config;
    const grid: number[][] = Array.from({ length: maxWeeks }, () => Array(maxDays).fill(0));
    let placed = 0;
    while (placed < commitCount) {
      const w = Math.floor(Math.random() * maxWeeks);
      const d = Math.floor(Math.random() * maxDays);
      grid[w][d] += 1;
      placed++;
    }
    return grid;
  }
  validate(config: GraphifyConfig): boolean {
    if (!config.maxWeeks || !config.maxDays || !config.commitCount) return false;
    return config.commitCount > 0;
  }
}

export default RandomPatternPlugin;
