/**
 * Centralized error handling for Graphify
 */

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
 * GraphifyError extends Error with additional information
 */
export class GraphifyError extends Error {
  public category: ErrorCategory;
  public original?: Error;
  public timestamp: Date;
  public level: ErrorLevel;
  public handled: boolean = false;
  public code?: string;

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
    this.level = level;
  }
}

/**
 * ErrorHandler is responsible for handling and formatting errors
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private debugMode: boolean = false;

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
   * Enable/disable debug mode
   * @param enabled Whether debug mode should be enabled
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Handle an error
   * @param error Error to handle
   * @param exit Whether to exit the process after handling
   */
  public handle(error: unknown, exit: boolean = false): void {
    // Convert to GraphifyError if needed
    const graphifyError = this.ensureGraphifyError(error);

    // Mark as handled to prevent duplicate handling
    if (graphifyError.handled) {
      return;
    }
    graphifyError.handled = true;

    // Log the error
    this.logError(graphifyError);

    // Exit if requested
    if (exit) {
      process.exit(1);
    }
  }

  /**
   * Ensure an error is a GraphifyError
   * @param error Any error object
   * @returns A GraphifyError
   */
  private ensureGraphifyError(error: unknown): GraphifyError {
    if (error instanceof GraphifyError) {
      return error;
    }

    if (error instanceof Error) {
      return new GraphifyError(
        error.message,
        ErrorCategory.UNEXPECTED,
        error
      );
    }

    return new GraphifyError(
      typeof error === 'string' ? error : 'Unknown error',
      ErrorCategory.UNEXPECTED
    );
  }

  /**
   * Log an error to the console
   * @param error The error to log
   */
  private logError(error: GraphifyError): void {
    // Format category for display
    const category = error.category.charAt(0).toUpperCase() +
                    error.category.slice(1).toLowerCase();

    // Log the error
    console.error(`[${error.level}] [${category}]: ${error.message}`);

    // Log original error if available
    if (error.original && this.debugMode) {
      console.error('Original Error:', error.original);
    }

    // Log stack trace in debug mode
    if (this.debugMode && error.stack) {
      console.error('Stack Trace:', error.stack);
    }
  }
}

export default ErrorHandler;
