import chalk from 'chalk';
import { UserPreferences } from '../../config/user-preferences';

/**
 * Theme interface defining all themeable elements
 */
export interface Theme {
  name: string;
  description: string;

  // UI elements
  primary: (text: any) => string;
  secondary: (text: any) => string;
  accent: (text: any) => string;
  highlight: (text: any) => string;
  muted: (text: any) => string;

  // Content
  heading: (text: any) => string;
  subheading: (text: any) => string;
  text: (text: any) => string;
  link: (text: any) => string;
  code: (text: any) => string;

  // Status indicators
  success: (text: any) => string;
  warning: (text: any) => string;
  error: (text: any) => string;
  info: (text: any) => string;

  // Tables and data
  table: (text: any) => string;
  tableHeader: (text: any) => string;

  // Components
  label: (text: any) => string;
  value: (text: any) => string;
  commandName: (text: any) => string;
  optionFlag: (text: any) => string;
  optionDefault: (text: any) => string;
  progressBar: (text: any) => string;
  progressText: (text: any) => string;

  // Branding
  logo: (text: any) => string;
}

/**
 * Theme manager singleton to manage theme selection and application
 */
export class ThemeManager {
  private static instance: ThemeManager;
  private themes: Map<string, Theme>;
  private currentTheme: Theme;
  private preferences: UserPreferences;

  private constructor() {
    this.themes = new Map();
    this.registerBuiltInThemes();

    // Initialize preferences
    this.preferences = new UserPreferences();

    // Set initial theme
    const savedTheme = this.preferences.get('theme');

    if (savedTheme && this.themes.has(savedTheme)) {
      this.currentTheme = this.themes.get(savedTheme)!;
    } else {
      this.currentTheme = this.themes.get('default')!;
    }
  }

  /**
   * Get singleton instance
   * @returns ThemeManager instance
   */
  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Register the built-in themes
   * @private
   */
  private registerBuiltInThemes(): void {
    // Default theme - blue and gray
    this.themes.set('default', {
      name: 'default',
      description: 'Default blue theme',

      // UI elements
      primary: (text: any) => chalk.blue(this.ensureString(text)),
      secondary: (text: any) => chalk.blueBright(this.ensureString(text)),
      accent: (text: any) => chalk.cyan(this.ensureString(text)),
      highlight: (text: any) => chalk.blueBright(this.ensureString(text)),
      muted: (text: any) => chalk.gray(this.ensureString(text)),

      // Content
      heading: (text: any) => chalk.bold.blue(this.ensureString(text)),
      subheading: (text: any) => chalk.bold.blueBright(this.ensureString(text)),
      text: (text: any) => chalk.white(this.ensureString(text)),
      link: (text: any) => chalk.underline.cyan(this.ensureString(text)),
      code: (text: any) => chalk.gray(this.ensureString(text)),

      // Status indicators
      success: (text: any) => chalk.green(this.ensureString(text)),
      warning: (text: any) => chalk.yellow(this.ensureString(text)),
      error: (text: any) => chalk.red(this.ensureString(text)),
      info: (text: any) => chalk.cyan(this.ensureString(text)),

      // Tables and data
      table: (text: any) => chalk.blue(this.ensureString(text)),
      tableHeader: (text: any) => chalk.bold.white(this.ensureString(text)),

      // Components
      label: (text: any) => chalk.bold.white(this.ensureString(text)),
      value: (text: any) => chalk.white(this.ensureString(text)),
      commandName: (text: any) => chalk.bold.cyan(this.ensureString(text)),
      optionFlag: (text: any) => chalk.yellow(this.ensureString(text)),
      optionDefault: (text: any) => chalk.gray(this.ensureString(text)),
      progressBar: (text: any) => chalk.blue(this.ensureString(text)),
      progressText: (text: any) => chalk.white(this.ensureString(text)),

      // Branding
      logo: (text: any) => chalk.bold.blue(this.ensureString(text))
    });

    // Dark theme - darker and more subdued
    this.themes.set('dark', {
      name: 'dark',
      description: 'Dark theme with subdued colors',

      // UI elements
      primary: (text: any) => chalk.gray(this.ensureString(text)),
      secondary: (text: any) => chalk.dim.white(this.ensureString(text)),
      accent: (text: any) => chalk.dim.blue(this.ensureString(text)),
      highlight: (text: any) => chalk.white(this.ensureString(text)),
      muted: (text: any) => chalk.dim.gray(this.ensureString(text)),

      // Content
      heading: (text: any) => chalk.bold.white(this.ensureString(text)),
      subheading: (text: any) => chalk.white(this.ensureString(text)),
      text: (text: any) => chalk.gray(this.ensureString(text)),
      link: (text: any) => chalk.underline.dim.blue(this.ensureString(text)),
      code: (text: any) => chalk.dim.white(this.ensureString(text)),

      // Status indicators
      success: (text: any) => chalk.green(this.ensureString(text)),
      warning: (text: any) => chalk.yellow(this.ensureString(text)),
      error: (text: any) => chalk.red(this.ensureString(text)),
      info: (text: any) => chalk.blue(this.ensureString(text)),

      // Tables and data
      table: (text: any) => chalk.dim.white(this.ensureString(text)),
      tableHeader: (text: any) => chalk.bold.white(this.ensureString(text)),

      // Components
      label: (text: any) => chalk.bold.gray(this.ensureString(text)),
      value: (text: any) => chalk.white(this.ensureString(text)),
      commandName: (text: any) => chalk.bold.white(this.ensureString(text)),
      optionFlag: (text: any) => chalk.dim.yellow(this.ensureString(text)),
      optionDefault: (text: any) => chalk.dim.gray(this.ensureString(text)),
      progressBar: (text: any) => chalk.gray(this.ensureString(text)),
      progressText: (text: any) => chalk.dim.white(this.ensureString(text)),

      // Branding
      logo: (text: any) => chalk.bold.white(this.ensureString(text))
    });

    // Vibrant theme - colorful and bright
    this.themes.set('vibrant', {
      name: 'vibrant',
      description: 'Vibrant colorful theme',

      // UI elements
      primary: (text: any) => chalk.magenta(this.ensureString(text)),
      secondary: (text: any) => chalk.cyan(this.ensureString(text)),
      accent: (text: any) => chalk.green(this.ensureString(text)),
      highlight: (text: any) => chalk.yellowBright(this.ensureString(text)),
      muted: (text: any) => chalk.gray(this.ensureString(text)),

      // Content
      heading: (text: any) => chalk.bold.magentaBright(this.ensureString(text)),
      subheading: (text: any) => chalk.magenta(this.ensureString(text)),
      text: (text: any) => chalk.white(this.ensureString(text)),
      link: (text: any) => chalk.underline.greenBright(this.ensureString(text)),
      code: (text: any) => chalk.cyan(this.ensureString(text)),

      // Status indicators
      success: (text: any) => chalk.greenBright(this.ensureString(text)),
      warning: (text: any) => chalk.yellowBright(this.ensureString(text)),
      error: (text: any) => chalk.redBright(this.ensureString(text)),
      info: (text: any) => chalk.cyanBright(this.ensureString(text)),

      // Tables and data
      table: (text: any) => chalk.magenta(this.ensureString(text)),
      tableHeader: (text: any) => chalk.bold.yellowBright(this.ensureString(text)),

      // Components
      label: (text: any) => chalk.bold.cyanBright(this.ensureString(text)),
      value: (text: any) => chalk.white(this.ensureString(text)),
      commandName: (text: any) => chalk.bold.yellowBright(this.ensureString(text)),
      optionFlag: (text: any) => chalk.greenBright(this.ensureString(text)),
      optionDefault: (text: any) => chalk.gray(this.ensureString(text)),
      progressBar: (text: any) => chalk.magentaBright(this.ensureString(text)),
      progressText: (text: any) => chalk.white(this.ensureString(text)),

      // Branding
      logo: (text: any) => chalk.bold.magentaBright(this.ensureString(text))
    });

    // GitHub theme - inspired by GitHub's colors
    this.themes.set('github', {
      name: 'github',
      description: 'GitHub-inspired theme',

      // UI elements
      primary: (text: any) => chalk.rgb(36, 41, 46)(this.ensureString(text)),
      secondary: (text: any) => chalk.rgb(88, 96, 105)(this.ensureString(text)),
      accent: (text: any) => chalk.rgb(3, 102, 214)(this.ensureString(text)),
      highlight: (text: any) => chalk.rgb(0, 92, 197)(this.ensureString(text)),
      muted: (text: any) => chalk.rgb(106, 115, 125)(this.ensureString(text)),

      // Content
      heading: (text: any) => chalk.bold.rgb(36, 41, 46)(this.ensureString(text)),
      subheading: (text: any) => chalk.rgb(88, 96, 105)(this.ensureString(text)),
      text: (text: any) => chalk.rgb(36, 41, 46)(this.ensureString(text)),
      link: (text: any) => chalk.underline.rgb(3, 102, 214)(this.ensureString(text)),
      code: (text: any) => chalk.rgb(27, 31, 35)(this.ensureString(text)),

      // Status indicators
      success: (text: any) => chalk.rgb(40, 167, 69)(this.ensureString(text)),
      warning: (text: any) => chalk.rgb(255, 171, 0)(this.ensureString(text)),
      error: (text: any) => chalk.rgb(215, 58, 73)(this.ensureString(text)),
      info: (text: any) => chalk.rgb(0, 92, 197)(this.ensureString(text)),

      // Tables and data
      table: (text: any) => chalk.rgb(88, 96, 105)(this.ensureString(text)),
      tableHeader: (text: any) => chalk.bold.rgb(36, 41, 46)(this.ensureString(text)),

      // Components
      label: (text: any) => chalk.bold.rgb(88, 96, 105)(this.ensureString(text)),
      value: (text: any) => chalk.rgb(36, 41, 46)(this.ensureString(text)),
      commandName: (text: any) => chalk.bold.rgb(3, 102, 214)(this.ensureString(text)),
      optionFlag: (text: any) => chalk.rgb(0, 92, 197)(this.ensureString(text)),
      optionDefault: (text: any) => chalk.rgb(106, 115, 125)(this.ensureString(text)),
      progressBar: (text: any) => chalk.rgb(3, 102, 214)(this.ensureString(text)),
      progressText: (text: any) => chalk.rgb(36, 41, 46)(this.ensureString(text)),

      // Branding
      logo: (text: any) => chalk.bold.rgb(3, 102, 214)(this.ensureString(text))
    });

    // Night theme - dark with blue tones
    this.themes.set('night', {
      name: 'night',
      description: 'Night mode with blue tones',

      // UI elements
      primary: (text: any) => chalk.rgb(56, 88, 152)(this.ensureString(text)),
      secondary: (text: any) => chalk.rgb(77, 123, 209)(this.ensureString(text)),
      accent: (text: any) => chalk.rgb(25, 200, 255)(this.ensureString(text)),
      highlight: (text: any) => chalk.rgb(185, 215, 255)(this.ensureString(text)),
      muted: (text: any) => chalk.rgb(100, 120, 150)(this.ensureString(text)),

      // Content
      heading: (text: any) => chalk.bold.rgb(185, 215, 255)(this.ensureString(text)),
      subheading: (text: any) => chalk.rgb(120, 160, 230)(this.ensureString(text)),
      text: (text: any) => chalk.rgb(220, 230, 240)(this.ensureString(text)),
      link: (text: any) => chalk.underline.rgb(25, 200, 255)(this.ensureString(text)),
      code: (text: any) => chalk.rgb(90, 110, 140)(this.ensureString(text)),

      // Status indicators
      success: (text: any) => chalk.rgb(80, 200, 120)(this.ensureString(text)),
      warning: (text: any) => chalk.rgb(255, 180, 70)(this.ensureString(text)),
      error: (text: any) => chalk.rgb(255, 100, 120)(this.ensureString(text)),
      info: (text: any) => chalk.rgb(80, 180, 255)(this.ensureString(text)),

      // Tables and data
      table: (text: any) => chalk.rgb(77, 123, 209)(this.ensureString(text)),
      tableHeader: (text: any) => chalk.bold.rgb(185, 215, 255)(this.ensureString(text)),

      // Components
      label: (text: any) => chalk.bold.rgb(150, 180, 230)(this.ensureString(text)),
      value: (text: any) => chalk.rgb(220, 230, 240)(this.ensureString(text)),
      commandName: (text: any) => chalk.bold.rgb(25, 200, 255)(this.ensureString(text)),
      optionFlag: (text: any) => chalk.rgb(150, 180, 230)(this.ensureString(text)),
      optionDefault: (text: any) => chalk.rgb(100, 120, 150)(this.ensureString(text)),
      progressBar: (text: any) => chalk.rgb(56, 88, 152)(this.ensureString(text)),
      progressText: (text: any) => chalk.rgb(185, 215, 255)(this.ensureString(text)),

      // Branding
      logo: (text: any) => chalk.bold.rgb(77, 123, 209)(this.ensureString(text))
    });
  }

  /**
   * Get the current theme
   * @returns The current theme
   */
  public getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Get a list of all available themes
   * @returns Array of theme names and descriptions
   */
  public getAvailableThemes(): Array<{ name: string; description: string }> {
    const themes: Array<{ name: string; description: string }> = [];

    for (const [name, theme] of this.themes.entries()) {
      themes.push({
        name,
        description: theme.description,
      });
    }

    return themes;
  }

  /**
   * Set the current theme
   * @param themeName Name of the theme to set
   * @returns True if theme was set, false if theme doesn't exist
   */
  public setTheme(themeName: string): boolean {
    if (this.themes.has(themeName)) {
      this.currentTheme = this.themes.get(themeName)!;
      // Save preference
      this.preferences.set('theme', themeName);
      return true;
    }
    return false;
  }

  /**
   * Register a custom theme
   * @param theme The theme to register
   * @returns True if theme was registered, false if a theme with that name already exists
   */
  public registerTheme(theme: Theme): boolean {
    if (this.themes.has(theme.name)) {
      return false;
    }

    this.themes.set(theme.name, theme);
    return true;
  }

  // Forward all theme methods to current theme with proper type handling

  /**
   * Safely convert any input to a string
   * @param input Any input that needs to be converted to string
   * @returns String representation of the input
   */
  private ensureString(input: any): string {
    if (input === undefined || input === null) {
      return '';
    }

    // Handle empty objects (the source of our type errors)
    if (typeof input === 'object' && Object.keys(input).length === 0) {
      return '';
    }

    // Handle other non-string types
    if (typeof input !== 'string') {
      try {
        return String(input);
      } catch {
        return '';
      }
    }

    return input;
  }

  public primary(text: any): string {
    return this.currentTheme.primary(this.ensureString(text));
  }

  public secondary(text: any): string {
    return this.currentTheme.secondary(this.ensureString(text));
  }

  public accent(text: any): string {
    return this.currentTheme.accent(this.ensureString(text));
  }

  public highlight(text: any): string {
    return this.currentTheme.highlight(this.ensureString(text));
  }

  public muted(text: any): string {
    return this.currentTheme.muted(this.ensureString(text));
  }

  public heading(text: any): string {
    return this.currentTheme.heading(this.ensureString(text));
  }

  public subheading(text: any): string {
    return this.currentTheme.subheading(this.ensureString(text));
  }

  public text(text: any): string {
    return this.currentTheme.text(this.ensureString(text));
  }

  public link(text: any): string {
    return this.currentTheme.link(this.ensureString(text));
  }

  public code(text: any): string {
    return this.currentTheme.code(this.ensureString(text));
  }

  public success(text: any): string {
    return this.currentTheme.success(this.ensureString(text));
  }

  public warning(text: any): string {
    return this.currentTheme.warning(this.ensureString(text));
  }

  public error(text: any): string {
    return this.currentTheme.error(this.ensureString(text));
  }

  public info(text: any): string {
    return this.currentTheme.info(this.ensureString(text));
  }

  public table(text: any): string {
    return this.currentTheme.table(this.ensureString(text));
  }

  public tableHeader(text: any): string {
    return this.currentTheme.tableHeader(this.ensureString(text));
  }

  public label(text: any): string {
    return this.currentTheme.label(this.ensureString(text));
  }

  public value(text: any): string {
    return this.currentTheme.value(this.ensureString(text));
  }

  public commandName(text: any): string {
    return this.currentTheme.commandName(this.ensureString(text));
  }

  public optionFlag(text: any): string {
    return this.currentTheme.optionFlag(this.ensureString(text));
  }

  public optionDefault(text: any): string {
    return this.currentTheme.optionDefault(this.ensureString(text));
  }

  public progressBar(text: any): string {
    return this.currentTheme.progressBar(this.ensureString(text));
  }

  public progressText(text: any): string {
    return this.currentTheme.progressText(this.ensureString(text));
  }

  public logo(text: any): string {
    return this.currentTheme.logo(this.ensureString(text));
  }
}
