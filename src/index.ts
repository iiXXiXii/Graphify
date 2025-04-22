#!/usr/bin/env node

/**
 * Graphify: ESM-Strict, TypeScript Project Entry Point
 * GitHub Contribution Graph Generator
 */

import { runCLI } from './cli/cli.js';
import { GraphifyConfig } from './types/config.js';
import { ErrorHandler } from './utils/errorHandler.js';
import { Graphify } from './Graphify.js';

// Version from package.json
export const PACKAGE_VERSION = '1.1.0';

/**
 * Initialize with custom configuration
 * @param customConfig Custom configuration options
 * @returns Promise resolving when Graphify completes
 */
async function initialize(customConfig: Partial<GraphifyConfig> = {}): Promise<void> {
  try {
    // Merge default config with custom config (will be implemented in config.ts)
    const config = {
      ...customConfig,
    } as GraphifyConfig;

    console.log('\n🌟 Graphify - GitHub Contribution Graph Generator 🌟');
    console.log('---------------------------------------------');

    // Create Graphify instance
    const graphify = new Graphify(config);

    // Run the process
    await graphify.run();

    // Finalize with a current date commit
    await graphify.finalize();

    console.log('\n✅ Graphify process completed successfully!');
  } catch (error) {
    ErrorHandler.getInstance().handle(error);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    await runCLI();
  } catch (err) {
    ErrorHandler.getInstance().handle(err);
    process.exit(1);
  }
}

// Run main if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export for use as module
export { initialize, Graphify, GraphifyConfig };
export default initialize;
