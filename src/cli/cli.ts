/**
 * Modern Graphify CLI entry (stub, ready for Commander integration and plugin loading)
 */
import { GraphifyConfig } from '../types/config.js';

export async function runCLI(config: GraphifyConfig): Promise<void> {
  // TODO: Expand with interactive/command parsing
  console.log('✅ Graphify CLI running with config:', config);
}
