import type { PatternPlugin } from './interface.js';
import type { GraphifyConfig } from '../types/config.js';

export class RealisticPatternPlugin implements PatternPlugin {
  name = 'realistic';
  description = 'Generates a realistic distribution with focus on weekdays and holidays.';

  generatePattern(config: GraphifyConfig): number[][] {
    const { maxWeeks, maxDays, commitCount, activeDays = [1,2,3,4,5] } = config;
    const grid: number[][] = Array.from({ length: maxWeeks }, () => Array(maxDays).fill(0));
    let placed = 0;
    while (placed < commitCount) {
      let w = Math.floor(Math.random() * maxWeeks);
      let d = activeDays[Math.floor(Math.random() * activeDays.length)] ?? Math.floor(Math.random() * maxDays);
      grid[w][d] += 1;
      placed++;
    }
    return grid;
  }
  validate(config: GraphifyConfig): boolean {
    return !!(config.maxWeeks && config.maxDays && config.commitCount > 0 && Array.isArray(config.activeDays));
  }
}

export default RealisticPatternPlugin;
