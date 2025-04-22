/**
 * Plugin system interface for Graphify
 */
import { GraphifyConfig, PatternPlugin } from '../types/config.js';
import { ErrorHandler, ErrorCategory, GraphifyError } from '../utils/errorHandler.js';

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
    try {
      if (this.patterns.has(plugin.name)) {
        console.warn(`Pattern plugin '${plugin.name}' is already registered. Skipping.`);
        return false; // Pattern with this name already exists
      }

      this.patterns.set(plugin.name, plugin);
      return true;
    } catch (error) {
      ErrorHandler.getInstance().handle(
        new GraphifyError(
          `Failed to register pattern plugin '${plugin.name}': ${error instanceof Error ? error.message : String(error)}`,
          ErrorCategory.PLUGIN,
          error instanceof Error ? error : undefined
        )
      );
      return false;
    }
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
   * Generate a pattern based on config
   * @param config Configuration to use
   * @returns Generated pattern or null if pattern not found
   */
  public generatePattern(config: GraphifyConfig): number[][] | null {
    const patternName = config.pattern || 'random';
    const plugin = this.getPattern(patternName);

    if (!plugin) {
      ErrorHandler.getInstance().handle(
        new GraphifyError(
          `Pattern plugin '${patternName}' not found`,
          ErrorCategory.PLUGIN
        )
      );
      return null;
    }

    try {
      if (!plugin.validate(config)) {
        ErrorHandler.getInstance().handle(
          new GraphifyError(
            `Configuration is not valid for pattern '${patternName}'`,
            ErrorCategory.VALIDATION
          )
        );
        return null;
      }

      return plugin.generatePattern(config);
    } catch (error) {
      ErrorHandler.getInstance().handle(
        new GraphifyError(
          `Error generating pattern '${patternName}': ${error instanceof Error ? error.message : String(error)}`,
          ErrorCategory.PLUGIN,
          error instanceof Error ? error : undefined
        )
      );
      return null;
    }
  }
}

export default PluginRegistry;
