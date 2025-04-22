/**
 * Plugin system interface for Graphify
 */
import { GraphifyConfig, PatternPlugin } from '../types/config.js';

/**
 * Plugin registry for managing pattern plugins
 */
export class PluginRegistry {
  private static instance: PluginRegistry;
  private patterns: Map<string, PatternPlugin> = new Map();

  /**
   * Get the singleton instance
   */
  public static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  /**
   * Register a pattern plugin
   * @param plugin The pattern plugin to register
   * @returns Whether the registration was successful
   */
  public registerPattern(plugin: PatternPlugin): boolean {
    if (this.patterns.has(plugin.name)) {
      return false; // Pattern with this name already exists
    }

    this.patterns.set(plugin.name, plugin);
    return true;
  }

  /**
   * Get a specific pattern by name
   * @param name The name of the pattern
   * @returns The pattern plugin, or undefined if not found
   */
  public getPattern(name: string): PatternPlugin | undefined {
    return this.patterns.get(name);
  }

  /**
   * Get all registered patterns
   * @returns Array of all registered pattern plugins
   */
  public getAllPatterns(): PatternPlugin[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Check if a pattern exists
   * @param name The name of the pattern
   * @returns Whether the pattern exists
   */
  public hasPattern(name: string): boolean {
    return this.patterns.has(name);
  }

  /**
   * Initialize default pattern plugins
   */
  public initializeDefaults(): void {
    // This will be implemented when we add the default pattern plugins
    // We'll import and register them here
  }
}

export default PluginRegistry;
