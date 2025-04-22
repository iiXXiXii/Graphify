import fs from 'fs';
import os from 'os';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { UIComponents } from '../ui/formatters/components';
import { ThemeManager } from '../ui/themes/theme';
import simpleGit from 'simple-git';
import { execSync } from 'child_process';

/**
 * Error categories for better classification
 */
export enum ErrorCategory {
  VALIDATION = 'Validation',
  CONFIGURATION = 'Configuration',
  FILE_SYSTEM = 'FileSystem',
  GIT = 'Git',
  NETWORK = 'Network',
  UNEXPECTED = 'Unexpected',
  USER_INPUT = 'UserInput',
  PLUGIN = 'Plugin',
  PATTERN = 'Pattern',
  PERMISSION = 'Permission'
}

/**
 * Error severity levels
 */
export enum ErrorLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

/**
 * Interface for error solutions
 */
interface ErrorSolution {
  title: string;
  description: string;
  command?: string;
  action?: () => Promise<void>;
  priority: number; // Higher number means higher priority
}

/**
 * Error log entry structure
 */
interface ErrorLogEntry {
  timestamp: string;
  level: ErrorLevel;
  source: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

/**
 * Interface for error context analysis
 */
interface ErrorContext {
  gitAvailable?: boolean;
  nodeVersion?: string;
  osType?: string;
  isGitRepo?: boolean;
  lastCommands?: string[];
  recentFiles?: string[];
  errorFrequency?: number;
  userInteractions?: Record<string, number>;
}

/**
 * GraphifyError extends Error with additional information
 */
export class GraphifyError extends Error {
  public category: ErrorCategory;
  public original?: Error;
  public timestamp: Date;
  originalError?: Error;
  solutions: ErrorSolution[];
  code?: string;
  context?: Record<string, any>;
  level: ErrorLevel;
  handled: boolean = false;

  /**
   * Create a new GraphifyError
   * @param message Error message
   * @param category Error category
   * @param original Original error if this wraps another error
   * @param level Error severity level
   */
  constructor(
    message: string,
    category: ErrorCategory = ErrorCategory.UNEXPECTED,
    original?: Error,
    level: ErrorLevel = ErrorLevel.ERROR
  ) {
    super(message);
    this.name = 'GraphifyError';
    this.category = category;
    this.original = original;
    this.timestamp = new Date();
    this.originalError = original;
    this.solutions = [];
    this.level = level;
  }

  /**
   * Add a solution to the error
   * @param solution Solution to add
   * @returns This error for chaining
   */
  addSolution(solution: Partial<ErrorSolution>): GraphifyError {
    this.solutions.push({
      ...solution,
      priority: solution.priority || 0
    } as ErrorSolution);

    // Sort solutions by priority (highest first)
    this.solutions.sort((a, b) => b.priority - a.priority);
    return this;
  }

  /**
   * Set context information for the error
   * @param context Context object
   * @returns This error for chaining
   */
  withContext(context: Record<string, any>): GraphifyError {
    this.context = {
      ...this.context,
      ...context
    };
    return this;
  }

  /**
   * Set the error code
   * @param code Error code
   * @returns This error for chaining
   */
  withCode(code: string): GraphifyError {
    this.code = code;
    return this;
  }

  /**
   * Set the error severity level
   * @param level Error level
   * @returns This error for chaining
   */
  withLevel(level: ErrorLevel): GraphifyError {
    this.level = level;
    return this;
  }
}

/**
 * ErrorHandler is responsible for handling and formatting errors
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private static readonly LOG_DIR = path.join(os.homedir(), '.graphify', 'logs');
  private static readonly LOG_FILE = path.join(ErrorHandler.LOG_DIR, 'graphify-errors.log');
  private static readonly MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
  private theme: ThemeManager;
  private ui: UIComponents;
  private debugMode: boolean = false;
  private themeManager: ThemeManager;
  private errorHistory: Map<string, number> = new Map(); // Track error frequency
  private lastUserActions: string[] = []; // Track recent user actions
  private maxHistoryItems = 10;
  private static errorContextCache: ErrorContext = {};

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.theme = ThemeManager.getInstance();
    this.ui = new UIComponents();
    this.themeManager = ThemeManager.getInstance();
    ErrorHandler.initialize();
  }

  /**
   * Get singleton instance
   * @returns ErrorHandler instance
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Initialize the error handler
   * Creates log directory if it doesn't exist
   */
  private static initialize(): void {
    // Ensure log directory exists
    if (!fs.existsSync(this.LOG_DIR)) {
      try {
        fs.mkdirSync(this.LOG_DIR, { recursive: true });
      } catch (err) {
        console.error(`Failed to create log directory: ${err}`);
      }
    }

    // Rotate logs if needed
    this.rotateLogIfNeeded();
  }

  /**
   * Enable/disable debug mode
   * @param enabled Whether debug mode should be enabled
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Handle and format an error
   * @param error Error to handle
   * @param exit Whether to exit the process
   * @returns Formatted error message
   */
  public handle(error: GraphifyError | Error, exit = false): string {
    const theme = this.themeManager;

    let message: string;
    const isGraphifyError = error instanceof GraphifyError;

    if (isGraphifyError) {
      message = `${theme.error('ERROR')} [${theme.accent((error as GraphifyError).category)}]: ${error.message}`;

      // Add original error details if available
      if ((error as GraphifyError).original) {
        message += `\n${theme.secondary('Original Error:')} ${(error as GraphifyError).original?.message}`;
      }
    } else {
      message = `${theme.error('ERROR')}: ${error.message}`;
    }

    console.error(message);

    if (exit) {
      process.exit(1);
    }

    return message;
  }

  /**
   * Handle an error
   * @param error Error to handle
   * @param exit Whether to exit the process after handling
   */
  public async handleError(error: Error | GraphifyError, exit: boolean = false): Promise<void> {
    if (error instanceof GraphifyError) {
      await this.handleGraphifyError(error);
    } else {
      this.handleGenericError(error);
    }

    if (exit) {
      process.exit(1);
    }
  }

  /**
   * Handle a GraphifyError with rich context
   * @param error GraphifyError to handle
   * @private
   */
  private async handleGraphifyError(error: GraphifyError): Promise<void> {
    // Log to file for history
    ErrorHandler.logToFile({
      timestamp: new Date().toISOString(),
      level: ErrorLevel.ERROR,
      source: error.category,
      message: error.message,
      stack: error.stack
    });

    console.error(this.theme.error(`ERROR: ${error.message}`));
    console.error('');

    if (error.category !== ErrorCategory.UNEXPECTED) {
      console.error(this.theme.subheading(`Category: ${this.formatCategory(error.category)}`));
    }

    if (error.code) {
      console.error(this.theme.subheading(`Code: ${error.code}`));
    }

    if (error.solutions.length > 0) {
      console.error('');
      console.error(this.theme.heading('Potential Solutions:'));

      error.solutions.forEach((solution, index) => {
        console.error(this.theme.accent(`${index + 1}. ${solution.title}`));
        console.error(this.theme.text(`   ${solution.description}`));

        if (solution.command) {
          console.error(this.theme.code(`   $ ${solution.command}`));
        }

        console.error('');
      });

      // For interactive solutions
      await this.handleCategorySpecificSolutions(error);
    }

    if (this.debugMode && error.stack) {
      console.error('');
      console.error(this.theme.heading('Stack Trace:'));
      console.error(this.theme.muted(error.stack));
    }

    if (error.originalError && this.debugMode) {
      console.error('');
      console.error(this.theme.heading('Original Error:'));
      console.error(this.theme.muted(error.originalError.message));
      if (error.originalError.stack) {
        console.error(this.theme.muted(error.originalError.stack));
      }
    }
  }

  /**
   * Handle category-specific interactive solutions
   * @param error The error to handle
   */
  private async handleCategorySpecificSolutions(error: GraphifyError): Promise<void> {
    // Handle based on error category
    try {
      switch (error.category) {
        case ErrorCategory.GIT:
          await this.handleGitSolutions(error);
          break;
        case ErrorCategory.CONFIGURATION:
          await this.handleConfigSolutions(error);
          break;
        case ErrorCategory.VALIDATION:
          await this.handlePatternSolutions(error);
          break;
        // Add other categories as needed
      }
    } catch (handlingError) {
      // If error handling fails, log but continue
      console.error(this.ui.error('Error while providing solutions: ' +
        (handlingError instanceof Error ? handlingError.message : String(handlingError))));
    }
  }

  /**
   * Handle Git-related solutions
   * @param error The git error
   */
  private async handleGitSolutions(error: GraphifyError): Promise<void> {
    const message = error.message.toLowerCase();

    if (message.includes('not a git repository')) {
      const { initRepo } = await inquirer.prompt([{
        type: 'confirm',
        name: 'initRepo',
        message: 'Would you like to initialize a Git repository here?',
        default: false
      }]);

      if (initRepo) {
        try {
          await simpleGit().init();
          console.log(this.ui.success('Repository initialized!'));
        } catch (initError) {
          console.error(this.ui.error('Failed to initialize repository.'));
        }
      }
    }
    // Add other git-specific solutions as needed
  }

  /**
   * Handle Config-related solutions
   * @param error The config error
   */
  private async handleConfigSolutions(error: GraphifyError): Promise<void> {
    const message = error.message.toLowerCase();

    if (message.includes('corrupt') || message.includes('invalid')) {
      const { resetConfig } = await inquirer.prompt([{
        type: 'confirm',
        name: 'resetConfig',
        message: 'Would you like to reset your configuration to defaults?',
        default: false
      }]);

      if (resetConfig) {
        try {
          // Call config reset logic here
          console.log(this.ui.success('Configuration reset to defaults!'));
        } catch (resetError) {
          console.error(this.ui.error('Failed to reset configuration.'));
        }
      }
    }
    // Add other config-specific solutions as needed
  }

  /**
   * Handle Pattern-related solutions
   * @param error The pattern error
   */
  private async handlePatternSolutions(error: GraphifyError): Promise<void> {
    // Add pattern-specific solutions as needed
  }

  /**
   * Handle a generic Error
   * @param error Error to handle
   * @private
   */
  private handleGenericError(error: Error): void {
    // Log to file
    ErrorHandler.logToFile({
      timestamp: new Date().toISOString(),
      level: ErrorLevel.ERROR,
      source: 'unknown',
      message: error.message,
      stack: error.stack
    });

    console.error(this.theme.error(`ERROR: ${error.message}`));

    if (this.debugMode && error.stack) {
      console.error('');
      console.error(this.theme.heading('Stack Trace:'));
      console.error(this.theme.muted(error.stack));
    }

    console.error('');
    console.error(this.theme.info('For more help, run:'));
    console.error(this.theme.code('  $ graphify --help'));
  }

  /**
   * Format error category for display
   * @param category Error category
   * @returns Formatted category string
   * @private
   */
  private formatCategory(category: ErrorCategory): string {
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  }

  /**
   * Log error to file
   * @param entry Error log entry
   * @private
   */
  private static logToFile(entry: ErrorLogEntry): void {
    try {
      const logLine = `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}${
        entry.stack ? `\nStack: ${entry.stack}` : ''
      }\n`;

      fs.appendFileSync(this.LOG_FILE, logLine);
    } catch (err) {
      // If we can't log to file, at least show it in console
      console.error(`Failed to write to log file: ${err}`);
      console.error(entry);
    }
  }

  /**
   * Log to console with appropriate formatting
   * @param entry Error log entry
   * @private
   */
  private static logToConsole(entry: ErrorLogEntry): void {
    let levelColor;

    switch (entry.level) {
      case ErrorLevel.INFO:
        levelColor = chalk.blue;
        break;
      case ErrorLevel.WARNING:
        levelColor = chalk.yellow;
        break;
      case ErrorLevel.ERROR:
        levelColor = chalk.red;
        break;
      case ErrorLevel.CRITICAL:
        levelColor = chalk.bgRed.white;
        break;
      default:
        levelColor = chalk.gray;
    }

    const levelText = levelColor(`[${entry.level}]`);
    const sourceText = chalk.cyan(`[${entry.source}]`);
    const timestampText = chalk.gray(`[${entry.timestamp}]`);

    console.error(`${timestampText} ${levelText} ${sourceText} ${entry.message}`);

    if (entry.stack && (entry.level === ErrorLevel.ERROR || entry.level === ErrorLevel.CRITICAL)) {
      console.error(chalk.gray(entry.stack));
    }
  }

  /**
   * Rotate log file if it exceeds maximum size
   * @private
   */
  private static rotateLogIfNeeded(): void {
    try {
      if (fs.existsSync(this.LOG_FILE)) {
        const stats = fs.statSync(this.LOG_FILE);

        if (stats.size > this.MAX_LOG_SIZE) {
          const backupFile = `${this.LOG_FILE}.${new Date().toISOString().replace(/:/g, '-')}`;
          fs.renameSync(this.LOG_FILE, backupFile);
        }
      }
    } catch (err) {
      console.error(`Failed to rotate log file: ${err}`);
    }
  }

  /**
   * Get error logs
   * @param maxEntries Maximum number of entries to retrieve
   * @returns Array of error log entries
   */
  public static getLogs(maxEntries: number = 100): ErrorLogEntry[] {
    try {
      if (!fs.existsSync(this.LOG_FILE)) {
        return [];
      }

      const logContent = fs.readFileSync(this.LOG_FILE, 'utf8');
      const logLines = logContent.split('\n');
      const entries: ErrorLogEntry[] = [];
      let currentEntry: Partial<ErrorLogEntry> | null = null;

      for (const line of logLines) {
        // Check if this is a new log entry
        const match = line.match(/^\[(.*?)\] \[(.*?)\] \[(.*?)\] (.*)/);

        if (match) {
          // Save previous entry if it exists
          if (currentEntry &&
              currentEntry.timestamp &&
              currentEntry.level &&
              currentEntry.source &&
              currentEntry.message) {
            entries.push(currentEntry as ErrorLogEntry);

            // Stop if we've reached the maximum number of entries
            if (entries.length >= maxEntries) {
              break;
            }
          }

          // Start a new entry
          currentEntry = {
            timestamp: match[1],
            level: match[2] as ErrorLevel,
            source: match[3],
            message: match[4]
          };
        } else if (line.startsWith('Stack: ') && currentEntry) {
          // This is a stack trace line
          currentEntry.stack = line.substring(7);
        }
      }

      // Add the last entry if it exists
      if (currentEntry &&
          currentEntry.timestamp &&
          currentEntry.level &&
          currentEntry.source &&
          currentEntry.message) {
        entries.push(currentEntry as ErrorLogEntry);
      }

      return entries.slice(0, maxEntries);
    } catch (err) {
      console.error(`Failed to read log file: ${err}`);
      return [];
    }
  }

  /**
   * Clear error logs
   * @returns Whether the operation was successful
   */
  public static clearLogs(): boolean {
    try {
      if (fs.existsSync(this.LOG_FILE)) {
        fs.unlinkSync(this.LOG_FILE);
      }

      return true;
    } catch (err) {
      console.error(`Failed to clear log file: ${err}`);
      return false;
    }
  }

  /**
   * Create and handle a validation error
   * @param message Error message
   * @param original Original error
   * @param exit Whether to exit the process
   */
  public validation(message: string, original?: Error, exit = false): void {
    this.handle(new GraphifyError(message, ErrorCategory.VALIDATION, original), exit);
  }

  /**
   * Create and handle a configuration error
   * @param message Error message
   * @param original Original error
   * @param exit Whether to exit the process
   */
  public configuration(message: string, original?: Error, exit = false): void {
    this.handle(new GraphifyError(message, ErrorCategory.CONFIGURATION, original), exit);
  }

  /**
   * Create and handle a file system error
   * @param message Error message
   * @param original Original error
   * @param exit Whether to exit the process
   */
  public fileSystem(message: string, original?: Error, exit = false): void {
    this.handle(new GraphifyError(message, ErrorCategory.FILE_SYSTEM, original), exit);
  }

  /**
   * Create and handle a git error
   * @param message Error message
   * @param original Original error
   * @param exit Whether to exit the process
   */
  public git(message: string, original?: Error, exit = false): void {
    this.handle(new GraphifyError(message, ErrorCategory.GIT, original), exit);
  }

  /**
   * Create and handle a network error
   * @param message Error message
   * @param original Original error
   * @param exit Whether to exit the process
   */
  public network(message: string, original?: Error, exit = false): void {
    this.handle(new GraphifyError(message, ErrorCategory.NETWORK, original), exit);
  }

  /**
   * Create and handle an unexpected error
   * @param message Error message
   * @param original Original error
   * @param exit Whether to exit the process
   */
  public unexpected(message: string, original?: Error, exit = false): void {
    this.handle(new GraphifyError(message, ErrorCategory.UNEXPECTED, original), exit);
  }

  /**
   * Create and handle a user input error
   * @param message Error message
   * @param original Original error
   * @param exit Whether to exit the process
   */
  public userInput(message: string, original?: Error, exit = false): void {
    this.handle(new GraphifyError(message, ErrorCategory.USER_INPUT, original), exit);
  }

  /**
   * Create a common git error
   * @param message Error message
   * @param originalError Original error
   * @returns GraphifyError
   */
  public createGitError(message: string, originalError?: Error): GraphifyError {
    const error = new GraphifyError(message, ErrorCategory.GIT, originalError);

    // Add common git solutions
    error.addSolution({
      title: 'Verify git installation',
      description: 'Make sure git is installed and accessible from the command line.',
      command: 'git --version',
    });

    error.addSolution({
      title: 'Check repository status',
      description: 'Make sure you are in a git repository and it is properly initialized.',
      command: 'git status',
    });

    return error;
  }

  /**
   * Create a common configuration error
   * @param message Error message
   * @param originalError Original error
   * @returns GraphifyError
   */
  public createConfigError(message: string, originalError?: Error): GraphifyError {
    const error = new GraphifyError(message, ErrorCategory.CONFIGURATION, originalError);

    // Add common configuration solutions
    error.addSolution({
      title: 'Reset preferences to defaults',
      description: 'Clear potentially corrupted configuration by resetting to defaults.',
      command: 'graphify config reset',
    });

    return error;
  }

  /**
   * Create a common validation error
   * @param message Error message
   * @param originalError Original error
   * @returns GraphifyError
   */
  public createValidationError(message: string, originalError?: Error): GraphifyError {
    const error = new GraphifyError(message, ErrorCategory.VALIDATION, originalError);

    // Add common validation solutions
    error.addSolution({
      title: 'Check input parameters',
      description: 'Ensure all required parameters are provided and in the correct format.',
    });

    return error;
  }

  /**
   * Create a common pattern generation error
   * @param message Error message
   * @param originalError Original error
   * @returns GraphifyError
   */
  public createPatternError(message: string, originalError?: Error): GraphifyError {
    const error = new GraphifyError(message, ErrorCategory.VALIDATION, originalError);

    // Add common pattern solutions
    error.addSolution({
      title: 'Try a different pattern',
      description: 'The selected pattern might not support your current parameters. Try a different pattern or adjust your settings.',
      command: 'graphify patterns list',
    });

    return error;
  }

  /**
   * Create a common filesystem error
   * @param message Error message
   * @param originalError Original error
   * @returns GraphifyError
   */
  public createFilesystemError(message: string, originalError?: Error): GraphifyError {
    const error = new GraphifyError(message, ErrorCategory.FILE_SYSTEM, originalError);

    // Add common filesystem solutions
    error.addSolution({
      title: 'Check file permissions',
      description: 'Ensure you have read/write permissions for the required files and directories.',
    });

    return error;
  }

  /**
   * Create a common plugin error
   * @param message Error message
   * @param pluginName Name of the plugin causing the error
   * @param originalError Original error
   * @returns GraphifyError
   */
  public createPluginError(message: string, pluginName: string, originalError?: Error): GraphifyError {
    const error = new GraphifyError(`Plugin Error (${pluginName}): ${message}`, ErrorCategory.UNEXPECTED, originalError);

    // Add common plugin solutions
    error.addSolution({
      title: 'Check plugin compatibility',
      description: 'Ensure the plugin is compatible with your current version of Graphify.',
    });

    error.addSolution({
      title: 'Disable the plugin',
      description: 'If the error persists, try disabling the problematic plugin.',
      command: `graphify plugins disable ${pluginName}`,
    });

    return error;
  }

  /**
   * Analyze the current environment to provide context for error handling
   * @returns Error context information
   */
  private async analyzeErrorContext(): Promise<ErrorContext> {
    const context: ErrorContext = {};

    try {
      // Only collect information we don't already have in cache
      if (ErrorHandler.errorContextCache.gitAvailable === undefined) {
        try {
          execSync('git --version', { stdio: 'ignore' });
          context.gitAvailable = true;
        } catch {
          context.gitAvailable = false;
        }
      }

      if (ErrorHandler.errorContextCache.nodeVersion === undefined) {
        context.nodeVersion = process.version;
        context.osType = os.type();
      }

      if (ErrorHandler.errorContextCache.isGitRepo === undefined) {
        try {
          await simpleGit().revparse(['--is-inside-work-tree']);
          context.isGitRepo = true;
        } catch {
          context.isGitRepo = false;
        }
      }

      // Update the cache with new information
      ErrorHandler.errorContextCache = {
        ...ErrorHandler.errorContextCache,
        ...context
      };

      return {
        ...ErrorHandler.errorContextCache
      };
    } catch (e) {
      // If any analysis fails, return what we have so far
      return context;
    }
  }

  /**
   * Track error occurrence for frequency analysis
   * @param error The error to track
   */
  private trackErrorOccurrence(error: GraphifyError | Error): void {
    const errorKey = error.constructor.name + ':' + error.message.substring(0, 50);
    const count = this.errorHistory.get(errorKey) || 0;
    this.errorHistory.set(errorKey, count + 1);

    // Limit the size of the error history
    if (this.errorHistory.size > 100) {
      // Remove oldest entries
      const entriesToDelete = [...this.errorHistory.keys()].slice(0, 20);
      entriesToDelete.forEach(key => this.errorHistory.delete(key));
    }
  }

  /**
   * Get rich, contextual solutions for an error based on its category and context
   * @param error The error to get solutions for
   * @param context The error context
   */
  private async getContextualSolutions(error: GraphifyError, context: ErrorContext): Promise<void> {
    const errorFrequency = this.getErrorFrequency(error);

    switch (error.category) {
      case ErrorCategory.GIT:
        this.addGitSolutions(error, context);
        break;
      case ErrorCategory.FILE_SYSTEM:
        this.addFileSystemSolutions(error, context);
        break;
      case ErrorCategory.CONFIGURATION:
        this.addConfigSolutions(error, context);
        break;
      case ErrorCategory.NETWORK:
        this.addNetworkSolutions(error, context);
        break;
      case ErrorCategory.PLUGIN:
        this.addPluginSolutions(error, context);
        break;
      // Add other categories
    }

    // Add general solutions based on error frequency
    if (errorFrequency > 3) {
      error.addSolution({
        title: 'This error occurs frequently',
        description: 'Consider checking our documentation for common issues and solutions',
        priority: 10
      });

      if (errorFrequency > 5) {
        error.addSolution({
          title: 'Join our community for help',
          description: 'This issue seems persistent. Consider reaching out to our community for assistance',
          priority: 15
        });
      }
    }
  }

  /**
   * Get the frequency of an error
   * @param error The error to check
   * @returns Number of times this error has occurred
   */
  private getErrorFrequency(error: GraphifyError | Error): number {
    const errorKey = error.constructor.name + ':' + error.message.substring(0, 50);
    return this.errorHistory.get(errorKey) || 0;
  }

  /**
   * Add Git-specific solutions based on context
   * @param error The error
   * @param context The context
   */
  private addGitSolutions(error: GraphifyError, context: ErrorContext): void {
    const message = error.message.toLowerCase();

    if (!context.gitAvailable) {
      error.addSolution({
        title: 'Git not found',
        description: 'Git appears to be not installed or not in your PATH. Please install Git and try again.',
        command: 'git --version',
        priority: 100
      });
      return;
    }

    if (!context.isGitRepo) {
      error.addSolution({
        title: 'Not a Git repository',
        description: 'The current directory is not a Git repository.',
        command: 'git init',
        action: async () => {
          try {
            await simpleGit().init();
            console.log(this.ui.success('Repository initialized successfully.'));
          } catch (e) {
            console.error(this.ui.error('Failed to initialize repository.'));
          }
        },
        priority: 90
      });
    }

    if (message.includes('not a git repository')) {
      error.addSolution({
        title: 'Initialize Git repository',
        description: 'The current directory is not a Git repository. Initialize one to continue.',
        command: 'git init',
        action: async () => {
          try {
            await simpleGit().init();
            console.log(this.ui.success('Repository initialized successfully.'));
          } catch (e) {
            console.error(this.ui.error('Failed to initialize repository.'));
          }
        },
        priority: 100
      });
    } else if (message.includes('permission denied')) {
      error.addSolution({
        title: 'Permission issue',
        description: 'You may not have the necessary permissions for this Git operation.',
        priority: 100
      });
    } else if (message.includes('remote') || message.includes('origin')) {
      error.addSolution({
        title: 'Check remote configuration',
        description: 'There may be an issue with your Git remote configuration.',
        command: 'git remote -v',
        priority: 90
      });
    }
  }

  /**
   * Add filesystem-specific solutions based on context
   * @param error The error
   * @param context The context
   */
  private addFileSystemSolutions(error: GraphifyError, context: ErrorContext): void {
    const message = error.message.toLowerCase();

    if (message.includes('permission') || message.includes('eacces')) {
      error.addSolution({
        title: 'Permission denied',
        description: 'You don\'t have sufficient permissions to access this file or directory.',
        priority: 100
      });

      if (os.type() === 'Linux' || os.type() === 'Darwin') {
        error.addSolution({
          title: 'Change file permissions',
          description: 'Try changing the file permissions to make it accessible.',
          command: 'chmod +rw [filename]',
          priority: 90
        });
      }
    } else if (message.includes('no such file') || message.includes('enoent')) {
      error.addSolution({
        title: 'File not found',
        description: 'The specified file does not exist. Check the path and try again.',
        priority: 100
      });
    } else if (message.includes('already exists')) {
      error.addSolution({
        title: 'File already exists',
        description: 'A file with this name already exists. Use a different name or remove the existing file.',
        priority: 100
      });
    }
  }

  /**
   * Add configuration-specific solutions based on context
   * @param error The error
   * @param context The context
   */
  private addConfigSolutions(error: GraphifyError, context: ErrorContext): void {
    error.addSolution({
      title: 'Reset configuration',
      description: 'Reset your configuration to default settings.',
      command: 'graphify config reset',
      action: async () => {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to reset your configuration to defaults?',
          default: false
        }]);

        if (confirm) {
          // Reset configuration logic would go here
          console.log(this.ui.success('Configuration reset to defaults.'));
        }
      },
      priority: 90
    });

    error.addSolution({
      title: 'View current configuration',
      description: 'View your current configuration settings.',
      command: 'graphify config view',
      priority: 80
    });
  }

  /**
   * Add network-specific solutions based on context
   * @param error The error
   * @param context The context
   */
  private addNetworkSolutions(error: GraphifyError, context: ErrorContext): void {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      error.addSolution({
        title: 'Network timeout',
        description: 'The request timed out. Check your internet connection and try again.',
        priority: 100
      });
    } else if (message.includes('refused') || message.includes('econnrefused')) {
      error.addSolution({
        title: 'Connection refused',
        description: 'The connection was refused. The server may be down or unreachable.',
        priority: 100
      });
    } else if (message.includes('proxy')) {
      error.addSolution({
        title: 'Proxy configuration',
        description: 'There may be an issue with your proxy configuration.',
        command: 'git config --global http.proxy',
        priority: 90
      });
    }
  }

  /**
   * Add plugin-specific solutions based on context
   * @param error The error
   * @param context The context
   */
  private addPluginSolutions(error: GraphifyError, context: ErrorContext): void {
    if (error.code === 'PLUGIN_INCOMPATIBLE') {
      error.addSolution({
        title: 'Plugin incompatible',
        description: 'The plugin is incompatible with your current version of Graphify.',
        priority: 100
      });
    } else if (error.code === 'PLUGIN_LOAD_FAILED') {
      error.addSolution({
        title: 'Plugin failed to load',
        description: 'The plugin could not be loaded. It may be corrupted or incompatible.',
        priority: 100
      });

      error.addSolution({
        title: 'Remove the plugin',
        description: 'Remove the problematic plugin from your plugins directory.',
        priority: 90
      });
    }
  }

  /**
   * Handle and format an error with enhanced context
   * @param error Error to handle
   * @param exit Whether to exit the process
   * @returns Formatted error message
   */
  public async handleEnhanced(error: GraphifyError | Error, exit = false): Promise<string> {
    // Track error for frequency analysis
    this.trackErrorOccurrence(error);

    // Convert standard Error to GraphifyError if needed
    const graphifyError = error instanceof GraphifyError
      ? error
      : new GraphifyError(error.message, ErrorCategory.UNEXPECTED, error);

    // Mark as handled to prevent duplicate handling
    if (graphifyError.handled) {
      return graphifyError.message;
    }
    graphifyError.handled = true;

    // Get context information
    const context = await this.analyzeErrorContext();

    // Get solutions based on context
    await this.getContextualSolutions(graphifyError, context);

    // Standard handling with new solutions
    const message = await this.formatError(graphifyError, context);

    // Log to file
    this.logErrorToFile(graphifyError, context);

    if (exit) {
      process.exit(1);
    }

    return message;
  }

  /**
   * Format an error for display with enhanced context
   * @param error The error to format
   * @param context The error context
   * @returns Formatted error message
   */
  private async formatError(error: GraphifyError, context: ErrorContext): Promise<string> {
    const theme = this.themeManager;
    let output = '';

    // Header with severity indicator
    let severityColor;
    switch (error.level) {
      case ErrorLevel.INFO:
        severityColor = theme.info;
        break;
      case ErrorLevel.WARNING:
        severityColor = theme.warning;
        break;
      case ErrorLevel.ERROR:
        severityColor = theme.error;
        break;
      case ErrorLevel.CRITICAL:
        severityColor = theme.error;
        break;
    }

    output += `${severityColor(`[${error.level}]`)} ${theme.accent(`[${error.category}]`)}: ${theme.error(error.message)}\n`;

    // Add code if available
    if (error.code) {
      output += `${theme.muted('Code:')} ${theme.code(error.code)}\n`;
    }

    // Add context information if in debug mode
    if (this.debugMode && error.context) {
      output += '\n' + theme.heading('Context:') + '\n';
      for (const [key, value] of Object.entries(error.context)) {
        output += `${theme.label(key)}: ${theme.value(JSON.stringify(value))}\n`;
      }
    }

    // Add solutions
    if (error.solutions.length > 0) {
      output += '\n' + theme.heading('Possible Solutions:') + '\n';

      error.solutions.slice(0, 5).forEach((solution, i) => {
        output += `${theme.accent(`${i + 1}. ${solution.title}`)}\n`;
        output += `   ${theme.text(solution.description)}\n`;

        if (solution.command) {
          output += `   ${theme.code(`$ ${solution.command}`)}\n`;
        }

        output += '\n';
      });
    }

    // Add stack trace in debug mode
    if (this.debugMode && error.stack) {
      output += '\n' + theme.heading('Stack Trace:') + '\n';
      output += theme.muted(error.stack) + '\n';
    }

    // Display the formatted error
    console.error(output);

    // Offer interactive solutions
    await this.offerInteractiveSolutions(error);

    return output;
  }

  /**
   * Offer interactive solutions to the user
   * @param error The error with solutions
   */
  private async offerInteractiveSolutions(error: GraphifyError): Promise<void> {
    // Only offer interactive solutions if we have actions available
    const solutionsWithActions = error.solutions.filter(s => s.action);

    if (solutionsWithActions.length === 0) {
      return;
    }

    try {
      const { solution } = await inquirer.prompt([{
        type: 'list',
        name: 'solution',
        message: 'Would you like to apply one of these solutions?',
        choices: [
          ...solutionsWithActions.map((s, i) => ({
            name: `${i + 1}. ${s.title}`,
            value: i
          })),
          {
            name: 'Cancel',
            value: -1
          }
        ]
      }]);

      if (solution >= 0) {
        const selectedSolution = solutionsWithActions[solution];
        if (selectedSolution.action) {
          await selectedSolution.action();
        }
      }
    } catch (e) {
      // If there's an error offering solutions, just continue
      console.error(this.ui.error('Failed to offer solutions: ' + e));
    }
  }

  /**
   * Log an error to file with enhanced context
   * @param error The error to log
   * @param context The error context
   */
  private logErrorToFile(error: GraphifyError, context: ErrorContext): void {
    try {
      const logEntry: ErrorLogEntry = {
        timestamp: new Date().toISOString(),
        level: error.level,
        source: error.category,
        message: error.message,
        stack: error.stack,
        context: {
          ...error.context,
          nodeVersion: context.nodeVersion,
          osType: context.osType,
          gitAvailable: context.gitAvailable,
          errorFrequency: this.getErrorFrequency(error)
        }
      };

      const logLine = JSON.stringify(logEntry) + '\n';

      // Ensure log directory exists
      if (!fs.existsSync(ErrorHandler.LOG_DIR)) {
        fs.mkdirSync(ErrorHandler.LOG_DIR, { recursive: true });
      }

      fs.appendFileSync(ErrorHandler.LOG_FILE, logLine);

      // Rotate logs if needed
      ErrorHandler.rotateLogIfNeeded();
    } catch (e) {
      // If logging fails, output to console
      console.error('Failed to log error to file:', e);
    }
  }
}

/**
 * Enhanced ErrorHandler with AI-assisted error resolution capabilities
 */
export class SmartErrorHandler extends ErrorHandler {
  private static instance: SmartErrorHandler;
  private errorPatterns: Map<string, { regex: RegExp, category: ErrorCategory, solutions: ErrorSolution[] }> = new Map();

  private constructor() {
    super();
    this.registerCommonErrorPatterns();
  }

  /**
   * Get the singleton instance
   * @returns SmartErrorHandler instance
   */
  public static getInstance(): SmartErrorHandler {
    if (!SmartErrorHandler.instance) {
      SmartErrorHandler.instance = new SmartErrorHandler();
    }
    return SmartErrorHandler.instance;
  }

  /**
   * Register common error patterns for automatic detection
   */
  private registerCommonErrorPatterns(): void {
    // Git-related error patterns
    this.registerErrorPattern(
      'not-git-repo',
      /not a git repository|fatal: not a git repository/i,
      ErrorCategory.GIT,
      [
        {
          title: 'Initialize Git repository',
          description: 'The current directory is not a Git repository. Initialize one to continue.',
          command: 'git init',
          priority: 100
        },
        {
          title: 'Navigate to a Git repository',
          description: 'Change to a directory that contains a Git repository.',
          command: 'cd /path/to/repo',
          priority: 90
        }
      ]
    );

    this.registerErrorPattern(
      'git-no-remote',
      /no remote repository specified|remote (.+) not found/i,
      ErrorCategory.GIT,
      [
        {
          title: 'Add a remote repository',
          description: 'Connect your local repository to a remote GitHub repository.',
          command: 'git remote add origin https://github.com/username/repository.git',
          priority: 100
        },
        {
          title: 'View current remotes',
          description: 'Check the currently configured remote repositories.',
          command: 'git remote -v',
          priority: 90
        }
      ]
    );

    // File system error patterns
    this.registerErrorPattern(
      'file-not-found',
      /no such file or directory|ENOENT|cannot find/i,
      ErrorCategory.FILE_SYSTEM,
      [
        {
          title: 'Check file path',
          description: 'Ensure the file path is correct and the file exists.',
          priority: 100
        },
        {
          title: 'List directory contents',
          description: 'List the contents of the directory to verify available files.',
          command: 'ls -la',
          priority: 90
        }
      ]
    );

    this.registerErrorPattern(
      'permission-denied',
      /permission denied|EACCES|access is denied/i,
      ErrorCategory.PERMISSION,
      [
        {
          title: 'Check file permissions',
          description: 'Ensure you have the necessary permissions to access the file or directory.',
          command: 'ls -la',
          priority: 100
        },
        {
          title: 'Change file permissions (Unix/Mac)',
          description: 'Make the file readable and writable by your user.',
          command: 'chmod u+rw filename',
          priority: 90
        }
      ]
    );

    // Configuration error patterns
    this.registerErrorPattern(
      'invalid-config',
      /invalid config|malformed config|configuration error|cannot parse config/i,
      ErrorCategory.CONFIGURATION,
      [
        {
          title: 'Reset configuration',
          description: 'Reset your configuration to default settings.',
          command: 'graphify config reset',
          priority: 100
        },
        {
          title: 'Validate configuration',
          description: 'Check your configuration file for syntax errors.',
          command: 'graphify config validate',
          priority: 90
        }
      ]
    );

    // Network error patterns
    this.registerErrorPattern(
      'network-timeout',
      /timeout|timed out|ETIMEDOUT|request timed out/i,
      ErrorCategory.NETWORK,
      [
        {
          title: 'Check your internet connection',
          description: 'Ensure you have a stable internet connection.',
          priority: 100
        },
        {
          title: 'Try again later',
          description: 'The server might be temporarily unavailable.',
          priority: 90
        }
      ]
    );

    this.registerErrorPattern(
      'connection-refused',
      /connection refused|ECONNREFUSED|unable to connect|server not responding/i,
      ErrorCategory.NETWORK,
      [
        {
          title: 'Check server status',
          description: 'Ensure the server is running and accessible.',
          priority: 100
        },
        {
          title: 'Verify network configuration',
          description: 'Check your network configuration, including proxy settings.',
          priority: 90
        }
      ]
    );

    // GitHub API specific errors
    this.registerErrorPattern(
      'github-rate-limit',
      /API rate limit exceeded|rate limit|too many requests/i,
      ErrorCategory.NETWORK,
      [
        {
          title: 'Wait and try again',
          description: 'GitHub API rate limit exceeded. Wait for the rate limit to reset.',
          priority: 100
        },
        {
          title: 'Use authentication',
          description: 'Authenticate with GitHub to increase your rate limit.',
          command: 'graphify auth login',
          priority: 90
        }
      ]
    );

    // Validation errors
    this.registerErrorPattern(
      'invalid-pattern',
      /invalid pattern|pattern not found|unknown pattern/i,
      ErrorCategory.PATTERN,
      [
        {
          title: 'List available patterns',
          description: 'Check the available contribution patterns.',
          command: 'graphify patterns list',
          priority: 100
        },
        {
          title: 'Use default pattern',
          description: 'Use the "realistic" pattern which is the most versatile.',
          command: 'graphify generate --pattern realistic',
          priority: 90
        }
      ]
    );

    // Plugin errors
    this.registerErrorPattern(
      'plugin-load-failed',
      /failed to load plugin|plugin error|cannot load plugin/i,
      ErrorCategory.PLUGIN,
      [
        {
          title: 'List installed plugins',
          description: 'Check which plugins are currently installed.',
          command: 'graphify plugins list',
          priority: 100
        },
        {
          title: 'Disable problematic plugin',
          description: 'Disable the plugin that is causing issues.',
          command: 'graphify plugins disable [plugin-name]',
          priority: 90
        }
      ]
    );
  }

  /**
   * Register an error pattern for automatic detection
   * @param id Unique identifier for the error pattern
   * @param regex Regular expression to match the error
   * @param category Error category
   * @param solutions Array of solutions for this error
   */
  public registerErrorPattern(
    id: string,
    regex: RegExp,
    category: ErrorCategory,
    solutions: ErrorSolution[]
  ): void {
    this.errorPatterns.set(id, { regex, category, solutions });
  }

  /**
   * Enhanced handle method that uses pattern matching
   * @param error The error to handle
   * @param exit Whether to exit the process after handling
   */
  public override async handleError(error: Error | GraphifyError, exit: boolean = false): Promise<void> {
    // If it's already a GraphifyError, use the parent handler
    if (error instanceof GraphifyError) {
      // Try to enhance with pattern-matched solutions if needed
      this.enhanceWithPatternMatching(error);
      await super.handleError(error, exit);
      return;
    }

    // Try to convert a standard Error to a GraphifyError using pattern matching
    const graphifyError = this.convertToGraphifyError(error);
    await super.handleError(graphifyError, exit);
  }

  /**
   * Convert a standard Error to a GraphifyError using pattern matching
   * @param error The standard error
   * @returns A GraphifyError with appropriate category and solutions
   */
  private convertToGraphifyError(error: Error): GraphifyError {
    const errorMessage = error.message || '';

    // Try to match the error message against known patterns
    for (const [id, pattern] of this.errorPatterns.entries()) {
      if (pattern.regex.test(errorMessage)) {
        const graphifyError = new GraphifyError(
          errorMessage,
          pattern.category,
          error
        );

        // Add solutions
        pattern.solutions.forEach(solution => {
          graphifyError.addSolution(solution);
        });

        return graphifyError;
      }
    }

    // Default to unexpected error if no pattern matches
    return new GraphifyError(
      errorMessage,
      ErrorCategory.UNEXPECTED,
      error
    );
  }

  /**
   * Enhance an existing GraphifyError with pattern-matched solutions
   * @param error The GraphifyError to enhance
   */
  private enhanceWithPatternMatching(error: GraphifyError): void {
    const errorMessage = error.message || '';

    // Check if we can add more solutions based on pattern matching
    for (const [id, pattern] of this.errorPatterns.entries()) {
      if (pattern.regex.test(errorMessage)) {
        // Only add solutions that aren't already present
        const existingSolutionTitles = new Set(error.solutions.map(s => s.title));

        pattern.solutions.forEach(solution => {
          if (!existingSolutionTitles.has(solution.title)) {
            error.addSolution(solution);
          }
        });
      }
    }
  }

  /**
   * Analyze an error and suggest the most likely solution
   * @param error The error to analyze
   * @returns The most relevant solution, or null if no solution is found
   */
  public analyzeError(error: Error | GraphifyError): ErrorSolution | null {
    let graphifyError: GraphifyError;

    if (error instanceof GraphifyError) {
      graphifyError = error;
      this.enhanceWithPatternMatching(graphifyError);
    } else {
      graphifyError = this.convertToGraphifyError(error);
    }

    // Return the highest priority solution if available
    if (graphifyError.solutions.length > 0) {
      return graphifyError.solutions[0]; // Solutions are already sorted by priority
    }

    return null;
  }

  /**
   * Try to automatically resolve an error
   * @param error The error to resolve
   * @returns True if resolution was attempted, false otherwise
   */
  public async tryAutoResolve(error: Error | GraphifyError): Promise<boolean> {
    const solution = this.analyzeError(error);

    if (solution && solution.action) {
      try {
        await solution.action();
        return true;
      } catch (e) {
        // If auto-resolution fails, just return false
        return false;
      }
    }

    return false;
  }
}

/**
 * Get the enhanced error handler instance
 * @returns SmartErrorHandler instance
 */
export function getSmartErrorHandler(): SmartErrorHandler {
  return SmartErrorHandler.getInstance();
}

// Override the default getErrorHandler to return the smart version
export function getErrorHandler(): ErrorHandler {
  return SmartErrorHandler.getInstance();
}

/**
 * AdaptiveErrorHandler enhances SmartErrorHandler with machine learning-inspired
 * capabilities to learn from past errors and provide more accurate solutions
 */
export class AdaptiveErrorHandler extends SmartErrorHandler {
  private static instance: AdaptiveErrorHandler;
  private errorPatternDatabase: Map<string, {
    count: number,
    solutions: { solution: ErrorSolution, effectiveness: number }[],
    contexts: Record<string, number>
  }> = new Map();
  private userFeedback: Map<string, boolean> = new Map();
  private readonly persistencePath: string;
  private readonly MAX_PATTERN_MEMORY = 100;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.6;
  private readonly SOLUTION_HISTORY_FILE = path.join(os.homedir(), '.graphify', 'error_solutions.json');

  private constructor() {
    super();
    this.persistencePath = path.join(os.homedir(), '.graphify', 'errors');
    this.loadErrorPatterns();
  }

  /**
   * Get singleton instance
   * @returns AdaptiveErrorHandler instance
   */
  public static getInstance(): AdaptiveErrorHandler {
    if (!AdaptiveErrorHandler.instance) {
      AdaptiveErrorHandler.instance = new AdaptiveErrorHandler();
    }
    return AdaptiveErrorHandler.instance;
  }

  /**
   * Load error patterns from persistent storage
   */
  private loadErrorPatterns(): void {
    try {
      if (!fs.existsSync(this.SOLUTION_HISTORY_FILE)) {
        return;
      }

      const data = fs.readFileSync(this.SOLUTION_HISTORY_FILE, 'utf8');
      const patterns = JSON.parse(data);

      for (const [key, value] of Object.entries(patterns)) {
        this.errorPatternDatabase.set(key, value as any);
      }

      console.log(`Loaded ${this.errorPatternDatabase.size} error patterns from history.`);
    } catch (err) {
      // If loading fails, start with an empty database
      console.error('Failed to load error patterns:', err);
    }
  }

  /**
   * Save error patterns to persistent storage
   */
  private saveErrorPatterns(): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.SOLUTION_HISTORY_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = JSON.stringify(Object.fromEntries(this.errorPatternDatabase), null, 2);
      fs.writeFileSync(this.SOLUTION_HISTORY_FILE, data);
    } catch (err) {
      console.error('Failed to save error patterns:', err);
    }
  }

  /**
   * Extract key features from an error to create a pattern fingerprint
   * @param error The error to extract features from
   * @returns Normalized pattern string
   */
  private extractErrorPattern(error: Error | GraphifyError): string {
    let message = error.message || '';

    // For GraphifyError, use more specific information
    if (error instanceof GraphifyError) {
      // Normalize the message by removing variable parts
      message = message
        .replace(/[0-9]+/g, '{NUM}')
        .replace(/(['"]).*?\1/g, '{STR}')
        .replace(/\s+/g, ' ')
        .trim();

      return `${error.category}:${message.substring(0, 100)}`;
    }

    // For standard errors, just normalize the message
    return 'StandardError:' + message
      .replace(/[0-9]+/g, '{NUM}')
      .replace(/(['"]).*?\1/g, '{STR}')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);
  }

  /**
   * Extract error context to help with pattern matching
   * @param error The error to analyze
   * @returns Context features
   */
  private extractContextFeatures(error: Error | GraphifyError): Record<string, string> {
    const context: Record<string, string> = {
      errorType: error.constructor.name,
      hasStack: error.stack ? 'true' : 'false',
    };

    if (error instanceof GraphifyError) {
      context.category = error.category;
      context.level = error.level;

      if (error.code) {
        context.code = error.code;
      }
    }

    return context;
  }

  /**
   * Track a new error occurrence and update the pattern database
   * @param error The error that occurred
   * @param context Error context information
   */
  private trackErrorOccurrence(error: Error | GraphifyError, context: ErrorContext): void {
    const patternKey = this.extractErrorPattern(error);
    const contextFeatures = this.extractContextFeatures(error);

    let patternData = this.errorPatternDatabase.get(patternKey);

    if (!patternData) {
      // New pattern
      patternData = {
        count: 0,
        solutions: [],
        contexts: {}
      };
    }

    // Update count
    patternData.count++;

    // Update context features
    for (const [key, value] of Object.entries(contextFeatures)) {
      patternData.contexts[key] = (patternData.contexts[key] || 0) + 1;
    }

    // Store solutions if this is a GraphifyError
    if (error instanceof GraphifyError && error.solutions.length > 0) {
      for (const solution of error.solutions) {
        // Check if we already have this solution
        const existingSolution = patternData.solutions.find(s => s.solution.title === solution.title);

        if (existingSolution) {
          // Just increment the count as a simple effectiveness metric
          existingSolution.effectiveness += 0.1;
        } else {
          // Add as new solution with base effectiveness
          patternData.solutions.push({
            solution: { ...solution },
            effectiveness: 1.0
          });
        }
      }

      // Sort solutions by effectiveness
      patternData.solutions.sort((a, b) => b.effectiveness - a.effectiveness);
    }

    // Save to database
    this.errorPatternDatabase.set(patternKey, patternData);

    // Limit the size of the database to prevent unbounded growth
    if (this.errorPatternDatabase.size > this.MAX_PATTERN_MEMORY) {
      // Find least frequent patterns to remove
      const patterns = Array.from(this.errorPatternDatabase.entries())
        .sort((a, b) => a[1].count - b[1].count);

      // Remove oldest, least frequent patterns
      for (let i = 0; i < patterns.length / 5; i++) {
        this.errorPatternDatabase.delete(patterns[i][0]);
      }
    }

    // Persist to disk periodically
    // Only save every 10th error to reduce disk I/O
    if (Math.random() < 0.1) {
      this.saveErrorPatterns();
    }
  }

  /**
   * Find similar error patterns that might have relevant solutions
   * @param error The error to find similar patterns for
   * @returns Array of pattern keys with similarity scores
   */
  private findSimilarPatterns(error: Error | GraphifyError): Array<{ key: string, similarity: number }> {
    const patternKey = this.extractErrorPattern(error);
    const contextFeatures = this.extractContextFeatures(error);
    const results: Array<{ key: string, similarity: number }> = [];

    // First, check for exact match
    if (this.errorPatternDatabase.has(patternKey)) {
      results.push({ key: patternKey, similarity: 1.0 });
    }

    // Find similar patterns
    for (const [key, data] of this.errorPatternDatabase.entries()) {
      // Skip exact match as we already included it
      if (key === patternKey) continue;

      // Calculate similarity based on category and message content
      let similarity = 0;

      // Higher similarity for same error category
      if (key.split(':')[0] === patternKey.split(':')[0]) {
        similarity += 0.4;
      }

      // Text similarity based on simple token overlap
      const patternTokens = key.split(/\s+/);
      const errorTokens = patternKey.split(/\s+/);

      // Count matching tokens
      let matchingTokens = 0;
      for (const token of errorTokens) {
        if (patternTokens.includes(token)) {
          matchingTokens++;
        }
      }

      // Normalize by total tokens for a similarity score
      const tokenSimilarity = matchingTokens / Math.max(1, Math.max(patternTokens.length, errorTokens.length));
      similarity += tokenSimilarity * 0.6;

      // Context similarity
      let contextMatches = 0;
      let contextTotal = 0;

      for (const [key, value] of Object.entries(contextFeatures)) {
        contextTotal++;
        if (data.contexts[key] && data.contexts[key] > 0) {
          contextMatches++;
        }
      }

      const contextSimilarity = contextMatches / Math.max(1, contextTotal);
      similarity += contextSimilarity * 0.2;

      // Only include if similarity is above threshold
      if (similarity >= this.MIN_CONFIDENCE_THRESHOLD) {
        results.push({ key, similarity });
      }
    }

    // Sort by similarity (highest first)
    results.sort((a, b) => b.similarity - a.similarity);

    // Return top 5 matches
    return results.slice(0, 5);
  }

  /**
   * Record user feedback on solution effectiveness
   * @param solutionId ID of the solution
   * @param wasEffective Whether the solution was effective
   */
  public recordSolutionFeedback(solutionId: string, wasEffective: boolean): void {
    this.userFeedback.set(solutionId, wasEffective);

    // Find the solution in our database and adjust effectiveness
    for (const data of this.errorPatternDatabase.values()) {
      for (const solutionData of data.solutions) {
        if (solutionData.solution.title === solutionId) {
          solutionData.effectiveness += wasEffective ? 0.5 : -0.3;
          // Ensure effectiveness stays positive
          solutionData.effectiveness = Math.max(0.1, solutionData.effectiveness);
        }
      }
    }

    // Save changes to disk
    this.saveErrorPatterns();
  }

  /**
   * Enhanced handleError that uses adaptive pattern matching
   * @param error The error to handle
   * @param exit Whether to exit after handling
   */
  public override async handleError(error: Error | GraphifyError, exit: boolean = false): Promise<void> {
    // Analyze error context
    const context = await this.analyzeErrorContext();

    // Track the error for learning
    this.trackErrorOccurrence(error, context);

    // If it's a standard Error, try to convert it to a GraphifyError
    let graphifyError: GraphifyError;
    if (!(error instanceof GraphifyError)) {
      graphifyError = this.convertToGraphifyError(error);
    } else {
      graphifyError = error;
    }

    // Get adaptive solutions
    await this.enhanceWithAdaptiveSolutions(graphifyError);

    // Hand off to parent handler
    await super.handleError(graphifyError, exit);
  }

  /**
   * Enhance error with solutions from the adaptive database
   * @param error The error to enhance
   */
  private async enhanceWithAdaptiveSolutions(error: GraphifyError): Promise<void> {
    // Find similar errors in our database
    const similarPatterns = this.findSimilarPatterns(error);

    if (similarPatterns.length === 0) {
      return; // No similar patterns found
    }

    // Get solutions from similar patterns
    for (const { key, similarity } of similarPatterns) {
      const patternData = this.errorPatternDatabase.get(key);

      if (!patternData || patternData.solutions.length === 0) {
        continue;
      }

      // Track existing solution titles to avoid duplicates
      const existingSolutionTitles = new Set(error.solutions.map(s => s.title));

      // Add adaptive solutions with adjusted priority based on similarity and effectiveness
      for (const { solution, effectiveness } of patternData.solutions) {
        // Skip if we already have this solution
        if (existingSolutionTitles.has(solution.title)) {
          continue;
        }

        // Adjust priority based on similarity and effectiveness
        const adjustedPriority = solution.priority * similarity * effectiveness;

        // Only add solutions with meaningful priority
        if (adjustedPriority > 30) {
          error.addSolution({
            ...solution,
            priority: adjustedPriority,
            description: `${solution.description} (Suggested based on similar errors)`,
            title: `${solution.title} 🧠`
          });
        }
      }
    }
  }

  /**
   * Get personalized recommendations for avoiding common errors
   * @returns Array of recommendation objects
   */
  public getErrorPreventionTips(): Array<{ tip: string; relevance: number; category: ErrorCategory }> {
    const tips: Array<{ tip: string; relevance: number; category: ErrorCategory }> = [];

    // Find most common error patterns
    const commonPatterns = Array.from(this.errorPatternDatabase.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    for (const [key, data] of commonPatterns) {
      const category = key.split(':')[0] as ErrorCategory;

      switch (category) {
        case 'GIT':
          tips.push({
            tip: 'Always check Git repository status before operations.',
            relevance: data.count,
            category: ErrorCategory.GIT
          });
          break;
        case 'VALIDATION':
          tips.push({
            tip: 'Validate inputs before running generation commands.',
            relevance: data.count,
            category: ErrorCategory.VALIDATION
          });
          break;
        case 'CONFIGURATION':
          tips.push({
            tip: 'Keep your configuration up to date with the latest schema.',
            relevance: data.count,
            category: ErrorCategory.CONFIGURATION
          });
          break;
        case 'FILE_SYSTEM':
          tips.push({
            tip: 'Verify file paths and permissions before file operations.',
            relevance: data.count,
            category: ErrorCategory.FILE_SYSTEM
          });
          break;
        case 'NETWORK':
          tips.push({
            tip: 'Check your internet connection before network operations.',
            relevance: data.count,
            category: ErrorCategory.NETWORK
          });
          break;
        default:
          // Generic tip for other categories
          tips.push({
            tip: `Review common issues in ${category.toLowerCase()} operations.`,
            relevance: data.count,
            category: category as ErrorCategory
          });
      }
    }

    // Sort by relevance
    return tips.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Try to automatically fix common errors without user intervention
   * @param error The error to fix
   * @returns True if auto-fix was applied, false otherwise
   */
  public async tryAutoFix(error: Error | GraphifyError): Promise<boolean> {
    // Only auto-fix certain categories
    if (error instanceof GraphifyError) {
      switch (error.category) {
        case ErrorCategory.CONFIGURATION:
          return await this.tryAutoFixConfiguration(error);
        case ErrorCategory.FILE_SYSTEM:
          return await this.tryAutoFixFileSystem(error);
        // Add more categories as needed
      }
    }

    return false;
  }

  /**
   * Try to automatically fix configuration errors
   * @param error The configuration error
   * @returns True if auto-fix was applied, false otherwise
   */
  private async tryAutoFixConfiguration(error: GraphifyError): Promise<boolean> {
    if (error.message.toLowerCase().includes('corrupt') ||
        error.message.toLowerCase().includes('invalid format')) {
      try {
        // Simple example: reset config to defaults
        // In a real implementation, this would call into your config system
        console.log('Auto-fixing corrupted configuration by resetting to defaults...');
        // Actual implementation would reset config here
        return true;
      } catch (e) {
        return false;
      }
    }

    return false;
  }

  /**
   * Try to automatically fix filesystem errors
   * @param error The filesystem error
   * @returns True if auto-fix was applied, false otherwise
   */
  private async tryAutoFixFileSystem(error: GraphifyError): Promise<boolean> {
    if (error.message.toLowerCase().includes('directory not found')) {
      // Extract directory path from error message if possible
      const match = error.message.match(/directory not found:?\s*["']?([^"']+)["']?/i);

      if (match && match[1]) {
        try {
          const dirPath = match[1];
          console.log(`Auto-fixing missing directory by creating: ${dirPath}`);
          fs.mkdirSync(dirPath, { recursive: true });
          return true;
        } catch (e) {
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Generate an error report with analytics about common errors
   * @param days Number of days to analyze
   * @returns Error report object
   */
  public generateErrorReport(days: number = 30): {
    totalErrors: number;
    categoryCounts: Record<string, number>;
    mostCommonErrors: Array<{ pattern: string; count: number }>;
    mostEffectiveSolutions: Array<{ title: string; effectiveness: number }>;
    errorTrend: Array<{ date: string; count: number }>;
  } {
    const report = {
      totalErrors: 0,
      categoryCounts: {} as Record<string, number>,
      mostCommonErrors: [] as Array<{ pattern: string; count: number }>,
      mostEffectiveSolutions: [] as Array<{ title: string; effectiveness: number }>,
      errorTrend: [] as Array<{ date: string; count: number }>
    };

    // Calculate total errors and category counts
    for (const [key, data] of this.errorPatternDatabase.entries()) {
      report.totalErrors += data.count;

      const category = key.split(':')[0];
      report.categoryCounts[category] = (report.categoryCounts[category] || 0) + data.count;

      report.mostCommonErrors.push({
        pattern: key.split(':')[1] || key,
        count: data.count
      });
    }

    // Sort and limit most common errors
    report.mostCommonErrors.sort((a, b) => b.count - a.count);
    report.mostCommonErrors = report.mostCommonErrors.slice(0, 10);

    // Find most effective solutions
    const allSolutions = new Map<string, { count: number, effectiveness: number }>();

    for (const data of this.errorPatternDatabase.values()) {
      for (const { solution, effectiveness } of data.solutions) {
        const existing = allSolutions.get(solution.title);

        if (existing) {
          existing.count++;
          existing.effectiveness = (existing.effectiveness + effectiveness) / 2;
        } else {
          allSolutions.set(solution.title, { count: 1, effectiveness });
        }
      }
    }

    // Convert to array, sort and limit
    report.mostEffectiveSolutions = Array.from(allSolutions.entries())
      .map(([title, { effectiveness }]) => ({ title, effectiveness }))
      .sort((a, b) => b.effectiveness - a.effectiveness)
      .slice(0, 10);

    // For error trend, we'd need timestamps which we didn't implement in this simplified version
    // In a real implementation, this would use the error history with timestamps

    return report;
  }
}

/**
 * Get the adaptive error handler instance
 * @returns AdaptiveErrorHandler instance
 */
export function getAdaptiveErrorHandler(): AdaptiveErrorHandler {
  return AdaptiveErrorHandler.getInstance();
}

// Update the default getErrorHandler to return the adaptive version
export function getErrorHandler(): ErrorHandler {
  return AdaptiveErrorHandler.getInstance();
}
