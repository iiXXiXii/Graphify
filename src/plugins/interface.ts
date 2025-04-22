import { Container } from '../application/services/container';
import { BasePatternPlugin } from './patterns/basePatternPlugin';

/**
 * Context provided to plugins during initialization
 */
export interface PluginContext {
  /**
   * The DI container to register services
   */
  container: Container;

  /**
   * Register a pattern generator plugin
   * @param name Name of the pattern
   * @param pattern The pattern plugin instance
   */
  registerPattern: (name: string, pattern: BasePatternPlugin) => void;

  /**
   * Register a command
   */
  registerCommand: (name: string, handler: any) => void;

  /**
   * Register a validation rule
   */
  registerValidationRule: (name: string, rule: any) => void;

  /**
   * Register a formatter
   */
  registerFormatter: (name: string, formatter: any) => void;

  /**
   * Register a theme
   */
  registerTheme: (name: string, theme: any) => void;

  /**
   * Get the current configuration
   */
  getConfig: () => any;
}

/**
 * Base interface for all plugins
 */
export interface Plugin {
  /**
   * Unique name of the plugin
   */
  name: string;

  /**
   * Human-readable description of the plugin
   */
  description: string;

  /**
   * Plugin version
   */
  version: string;

  /**
   * Optional list of plugin dependencies
   */
  dependencies?: string[];

  /**
   * Initialize the plugin with the provided context
   * @param context The plugin context
   */
  initialize(context: PluginContext): void | Promise<void>;

  /**
   * Optional cleanup method called when the plugin is being unloaded
   * Use this to clean up any resources created by the plugin
   */
  cleanup?(): void | Promise<void>;
}
