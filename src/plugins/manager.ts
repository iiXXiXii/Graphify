import { Plugin, PluginContext } from './interface';
import { BasePatternPlugin } from './patterns/basePatternPlugin';
import { RandomPatternPlugin } from './patterns/randomPattern';
import { RealisticPatternPlugin } from './patterns/realisticPattern';
import fs from 'fs';
import path from 'path';

/**
 * Manager for handling plugins in the Graphify application
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private patternPlugins: Map<string, BasePatternPlugin> = new Map();

  /**
   * Initialize the plugin manager and load built-in plugins
   */
  constructor() {
    this.loadBuiltInPlugins();
  }

  /**
   * Load built-in plugins
   * @private
   */
  private loadBuiltInPlugins(): void {
    // Register built-in pattern generators
    this.registerPlugin(new RandomPatternPlugin());
    this.registerPlugin(new RealisticPatternPlugin());
  }

  /**
   * Register a plugin
   * @param plugin The plugin to register
   * @returns Success status
   */
  registerPlugin(plugin: Plugin): boolean {
    if (this.plugins.has(plugin.name)) {
      return false;
    }

    // Create a context for the plugin
    const context: PluginContext = {
      registerPattern: (name: string, patternPlugin: BasePatternPlugin) => {
        this.patternPlugins.set(name, patternPlugin);
      }
    };

    // Initialize the plugin with its context
    try {
      plugin.initialize(context);
      this.plugins.set(plugin.name, plugin);
      return true;
    } catch (error) {
      console.error(`Failed to initialize plugin ${plugin.name}:`, error);
      return false;
    }
  }

  /**
   * Load external plugins from a directory
   * @param pluginsDir Path to the plugins directory
   */
  async loadExternalPlugins(pluginsDir: string): Promise<void> {
    if (!fs.existsSync(pluginsDir)) {
      return;
    }

    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginDir = path.join(pluginsDir, entry.name);
        await this.loadExternalPlugin(pluginDir);
      }
    }
  }

  /**
   * Load a single external plugin from its directory
   * @param pluginDir Path to the plugin directory
   * @private
   */
  private async loadExternalPlugin(pluginDir: string): Promise<void> {
    const indexPath = path.join(pluginDir, 'index.js');

    if (!fs.existsSync(indexPath)) {
      console.warn(`Plugin directory ${pluginDir} has no index.js file, skipping.`);
      return;
    }

    try {
      // Dynamically import the plugin module
      const pluginModule = await import(indexPath);

      // Plugin should export a default class that implements Plugin
      if (!pluginModule.default) {
        console.warn(`Plugin ${pluginDir} does not export a default class.`);
        return;
      }

      // Create an instance of the plugin
      const plugin = new pluginModule.default() as Plugin;

      // Register the plugin
      if (!this.registerPlugin(plugin)) {
        console.warn(`Failed to register plugin ${plugin.name} from ${pluginDir}.`);
      }
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginDir}:`, error);
    }
  }

  /**
   * Get a specific pattern plugin by name
   * @param name Name of the pattern plugin
   * @returns The pattern plugin or undefined if not found
   */
  getPatternPlugin(name: string): BasePatternPlugin | undefined {
    return this.patternPlugins.get(name);
  }

  /**
   * Get all available pattern plugins
   * @returns A map of pattern plugins
   */
  getAllPatternPlugins(): Map<string, BasePatternPlugin> {
    return new Map(this.patternPlugins);
  }

  /**
   * Get a list of all available pattern names
   * @returns Array of pattern names
   */
  getAvailablePatterns(): string[] {
    return Array.from(this.patternPlugins.keys());
  }

  /**
   * Get a specific plugin by name
   * @param name Name of the plugin
   * @returns The plugin or undefined if not found
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins
   * @returns A map of registered plugins
   */
  getAllPlugins(): Map<string, Plugin> {
    return new Map(this.plugins);
  }
}
