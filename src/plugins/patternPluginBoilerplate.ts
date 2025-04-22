import type { PatternPlugin } from './interface.js';
import type { GraphifyConfig } from '../types/config.js';

export class YourPatternPlugin implements PatternPlugin {
  name = 'your-pattern';
  description = 'Describe what unique pattern this creates.';

  generatePattern(config: GraphifyConfig): number[][] {
    // Implement your logic here
    const { maxWeeks, maxDays, commitCount } = config;
    // Example: Alternate fill
    const grid = Array.from({ length: maxWeeks }, (_, w) =>
      Array.from({ length: maxDays }, (_, d) =>
        ((w + d) % 2 === 0 && commitCount > 0 ? 1 : 0)
      )
    );
    return grid;
  }
  validate(config: GraphifyConfig): boolean {
    // Enforce any constraints on config for this pattern
    return config.commitCount > 0;
  }
}

// Usage: Register in plugins/manager.ts
// import YourPatternPlugin from './patternPluginBoilerplate.js';
// manager.register(new YourPatternPlugin());
export default YourPatternPlugin;
