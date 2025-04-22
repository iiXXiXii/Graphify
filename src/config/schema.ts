import { GraphifyConfig } from '../types/config';
import { DateTime } from 'luxon';
import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import { GraphifyError, ErrorCategory } from '../utils/errorHandler';
import { deepMerge } from '../utils/fileManager';
import { defaultConfig } from './default';
import os from 'os';

/**
 * Configuration schema definition using JSON Schema
 */
export const configSchema = {
  type: 'object',
  properties: {
    version: { type: 'string' },
    user: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        preferredTheme: { type: 'string' },
        preferredPattern: { type: 'string' }
      },
      required: ['name', 'email']
    },
    github: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        personalAccessToken: { type: 'string' },
        repositories: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    analytics: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        anonymousId: { type: 'string' },
        trackingConsent: { type: 'boolean' }
      }
    },
    patterns: {
      type: 'object',
      properties: {
        defaultPattern: { type: 'string' },
        customPatterns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              algorithm: { type: 'string' }
            },
            required: ['name', 'algorithm']
          }
        }
      }
    },
    system: {
      type: 'object',
      properties: {
        logLevel: {
          type: 'string',
          enum: ['debug', 'info', 'warn', 'error']
        },
        dataDirectory: { type: 'string' },
        debug: { type: 'boolean' },
        maxConcurrentOperations: { type: 'integer', minimum: 1 }
      }
    },
    plugins: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        directory: { type: 'string' },
        autoUpdate: { type: 'boolean' },
        installed: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
              enabled: { type: 'boolean' }
            },
            required: ['name']
          }
        }
      }
    },
    advanced: {
      type: 'object',
      properties: {
        gitBinary: { type: ['string', 'null'] },
        timeoutMs: { type: 'integer', minimum: 100 },
        retryAttempts: { type: 'integer', minimum: 0 },
        experimental: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  },
  required: ['version', 'user']
};

/**
 * ConfigValidator provides methods to validate configuration objects
 * against the schema and repair common issues
 */
export class ConfigValidator {
  private ajv: Ajv;
  private defaultConfigPath: string;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    this.defaultConfigPath = path.join(os.homedir(), '.graphify', 'default-config.json');
  }

  /**
   * Validate configuration against the schema
   * @param config Configuration object to validate
   * @returns Validation result with errors if any
   */
  public validate(config: any): {
    valid: boolean;
    errors: any[] | null;
  } {
    const validate = this.ajv.compile(configSchema);
    const valid = validate(config);

    return {
      valid,
      errors: validate.errors
    };
  }

  /**
   * Check if configuration is valid
   * @param config Configuration to validate
   * @returns True if valid, false otherwise
   */
  public isValid(config: any): boolean {
    return this.validate(config).valid;
  }

  /**
   * Format validation errors into a human-readable string
   * @param errors Validation errors
   * @returns Formatted error message
   */
  public formatErrors(errors: any[]): string {
    if (!errors || errors.length === 0) {
      return 'No validation errors';
    }

    return errors.map(error => {
      const path = error.instancePath || '/';
      return `${path}: ${error.message}`;
    }).join('\n');
  }

  /**
   * Attempt to automatically repair common configuration issues
   * @param config The potentially invalid configuration
   * @returns Fixed configuration object if possible
   */
  public autoRepair(config: any): {
    fixed: boolean;
    config: any;
    repairs: string[];
  } {
    const result = {
      fixed: false,
      config: { ...config },
      repairs: [] as string[]
    };

    // Check if config is null or not an object at all
    if (!config || typeof config !== 'object') {
      result.config = { ...defaultConfig };
      result.repairs.push('Replaced completely invalid configuration with defaults');
      result.fixed = true;
      return result;
    }

    // Ensure version exists
    if (!config.version) {
      result.config.version = defaultConfig.version;
      result.repairs.push(`Added missing version: "${defaultConfig.version}"`);
      result.fixed = true;
    }

    // Ensure user section exists with required fields
    if (!config.user || typeof config.user !== 'object') {
      result.config.user = { ...defaultConfig.user };
      result.repairs.push('Added missing user information section');
      result.fixed = true;
    } else {
      // Fix user fields if they exist but are invalid
      if (!config.user.name || typeof config.user.name !== 'string') {
        result.config.user.name = defaultConfig.user.name;
        result.repairs.push('Added missing or invalid user name');
        result.fixed = true;
      }

      if (!config.user.email || typeof config.user.email !== 'string' || !this.isValidEmail(config.user.email)) {
        result.config.user.email = defaultConfig.user.email;
        result.repairs.push('Added missing or invalid user email');
        result.fixed = true;
      }
    }

    // Fix analytics section if needed
    if (!config.analytics || typeof config.analytics !== 'object') {
      result.config.analytics = { ...defaultConfig.analytics };
      result.repairs.push('Added missing analytics configuration');
      result.fixed = true;
    } else {
      // Fix specific analytics fields
      if (typeof config.analytics.enabled !== 'boolean') {
        result.config.analytics.enabled = defaultConfig.analytics.enabled;
        result.repairs.push('Fixed invalid analytics.enabled value');
        result.fixed = true;
      }
    }

    // Fix system section if needed
    if (!config.system || typeof config.system !== 'object') {
      result.config.system = { ...defaultConfig.system };
      result.repairs.push('Added missing system configuration');
      result.fixed = true;
    } else {
      // Fix specific system fields
      if (config.system.logLevel && !['debug', 'info', 'warn', 'error'].includes(config.system.logLevel)) {
        result.config.system.logLevel = defaultConfig.system.logLevel;
        result.repairs.push(`Fixed invalid logLevel: "${config.system.logLevel}" to "${defaultConfig.system.logLevel}"`);
        result.fixed = true;
      }

      if (typeof config.system.maxConcurrentOperations !== 'number' ||
          config.system.maxConcurrentOperations < 1 ||
          !Number.isInteger(config.system.maxConcurrentOperations)) {
        result.config.system.maxConcurrentOperations = defaultConfig.system.maxConcurrentOperations;
        result.repairs.push('Fixed invalid maxConcurrentOperations');
        result.fixed = true;
      }
    }

    // Fix patterns section if needed
    if (!config.patterns || typeof config.patterns !== 'object') {
      result.config.patterns = { ...defaultConfig.patterns };
      result.repairs.push('Added missing patterns configuration');
      result.fixed = true;
    } else {
      // Fix specific pattern fields
      if (!config.patterns.defaultPattern || typeof config.patterns.defaultPattern !== 'string') {
        result.config.patterns.defaultPattern = defaultConfig.patterns.defaultPattern;
        result.repairs.push('Fixed missing or invalid defaultPattern');
        result.fixed = true;
      }

      // Validate customPatterns array
      if (!Array.isArray(config.patterns.customPatterns)) {
        result.config.patterns.customPatterns = [...defaultConfig.patterns.customPatterns];
        result.repairs.push('Fixed invalid customPatterns (not an array)');
        result.fixed = true;
      } else {
        // Filter out invalid custom patterns
        const validCustomPatterns = config.patterns.customPatterns.filter((pattern: any) => {
          return pattern &&
                 typeof pattern === 'object' &&
                 typeof pattern.name === 'string' &&
                 typeof pattern.algorithm === 'string';
        });

        if (validCustomPatterns.length !== config.patterns.customPatterns.length) {
          result.config.patterns.customPatterns = validCustomPatterns;
          result.repairs.push('Removed invalid entries from customPatterns');
          result.fixed = true;
        }
      }
    }

    // Revalidate the fixed config to see if we resolved all issues
    const validation = this.validate(result.config);

    // If there are still errors that we couldn't fix, return the default config
    if (!validation.valid) {
      result.config = { ...defaultConfig };
      result.repairs.push('Configuration had unfixable errors, replaced with default configuration');
      result.fixed = true;
    }

    return result;
  }

  /**
   * Validate and potentially repair a configuration file
   * @param configPath Path to the configuration file
   * @returns Result of validation and repair
   */
  public validateConfigFile(configPath: string): {
    valid: boolean;
    repaired: boolean;
    errors: any[] | null;
    repairs: string[];
    config: any;
  } {
    try {
      // Check if file exists
      if (!fs.existsSync(configPath)) {
        throw new GraphifyError(`Configuration file not found at ${configPath}`, ErrorCategory.CONFIGURATION);
      }

      // Read and parse the config file
      const configContent = fs.readFileSync(configPath, 'utf-8');
      let config: any;

      try {
        config = JSON.parse(configContent);
      } catch (e) {
        throw new GraphifyError(`Invalid JSON in configuration file: ${e.message}`, ErrorCategory.CONFIGURATION);
      }

      // Validate the configuration
      const validationResult = this.validate(config);

      // If valid, return success
      if (validationResult.valid) {
        return {
          valid: true,
          repaired: false,
          errors: null,
          repairs: [],
          config
        };
      }

      // If invalid, try to repair
      const repairResult = this.autoRepair(config);

      // Check if repair succeeded
      if (repairResult.fixed) {
        // If repaired, write back to file
        fs.writeFileSync(configPath, JSON.stringify(repairResult.config, null, 2));

        return {
          valid: true,
          repaired: true,
          errors: validationResult.errors,
          repairs: repairResult.repairs,
          config: repairResult.config
        };
      }

      // If couldn't repair, return the errors
      return {
        valid: false,
        repaired: false,
        errors: validationResult.errors,
        repairs: [],
        config
      };

    } catch (error) {
      // Handle file system or parsing errors
      throw error instanceof GraphifyError
        ? error
        : new GraphifyError(
            `Error validating configuration: ${error.message}`,
            ErrorCategory.CONFIGURATION,
            error
          );
    }
  }

  /**
   * Create a backup of the default configuration
   */
  public saveDefaultConfig(): void {
    try {
      const configDir = path.dirname(this.defaultConfigPath);

      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Write default config to file
      fs.writeFileSync(
        this.defaultConfigPath,
        JSON.stringify(defaultConfig, null, 2)
      );
    } catch (e) {
      // Just log the error, don't throw
      console.error(`Failed to save default config: ${e.message}`);
    }
  }

  /**
   * Restore configuration to defaults
   * @param configPath Path to configuration file to reset
   * @returns Default configuration
   */
  public resetToDefaults(configPath: string): any {
    try {
      // Ensure the directory exists
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Write default config to file
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));

      return { ...defaultConfig };
    } catch (e) {
      throw new GraphifyError(
        `Failed to reset configuration to defaults: ${e.message}`,
        ErrorCategory.CONFIGURATION,
        e
      );
    }
  }

  /**
   * Basic email validation helper
   * @param email Email to validate
   * @returns True if valid, false otherwise
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Get the singleton validator instance
 * @returns ConfigValidator instance
 */
export function getConfigValidator(): ConfigValidator {
  return new ConfigValidator();
}

/**
 * ValidationError structure
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate configuration object against schema
 * @param config Configuration to validate
 * @returns Validation result
 */
export function validateConfig(config: Partial<GraphifyConfig>): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate commitCount
  if (config.commitCount !== undefined) {
    if (typeof config.commitCount !== 'number' || config.commitCount <= 0) {
      errors.push({
        field: 'commitCount',
        message: 'Commit count must be a positive number',
      });
    } else if (config.commitCount > 5000) {
      errors.push({
        field: 'commitCount',
        message: 'Commit count exceeds maximum allowed (5000)',
      });
    }
  }

  // Validate pattern
  if (config.pattern !== undefined) {
    const validPatterns = [
      'random', 'gradient', 'snake', 'heart', 'realistic', 'steady', 'crescendo', 'custom'
    ];

    if (!validPatterns.includes(config.pattern)) {
      errors.push({
        field: 'pattern',
        message: `Invalid pattern. Must be one of: ${validPatterns.join(', ')}`,
      });
    }
  }

  // Validate activeDays
  if (config.activeDays !== undefined) {
    if (!Array.isArray(config.activeDays)) {
      errors.push({
        field: 'activeDays',
        message: 'Active days must be an array',
      });
    } else {
      const invalidDays = config.activeDays.filter(day => !Number.isInteger(day) || day < 0 || day > 6);

      if (invalidDays.length > 0) {
        errors.push({
          field: 'activeDays',
          message: 'Active days must be integers between 0-6 (Sunday-Saturday)',
        });
      }
    }
  }

  // Validate timeOfDay
  if (config.timeOfDay !== undefined) {
    const validTimes = [
      'morning', 'afternoon', 'evening', 'night', 'random', 'working-hours', 'after-hours'
    ];

    if (!validTimes.includes(config.timeOfDay)) {
      errors.push({
        field: 'timeOfDay',
        message: `Invalid time of day. Must be one of: ${validTimes.join(', ')}`,
      });
    }
  }

  // Validate dates
  if (config.startDate !== undefined) {
    const startDate = DateTime.fromISO(config.startDate);

    if (!startDate.isValid) {
      errors.push({
        field: 'startDate',
        message: 'Start date must be a valid ISO date',
      });
    }
  }

  if (config.endDate !== undefined) {
    const endDate = DateTime.fromISO(config.endDate);

    if (!endDate.isValid) {
      errors.push({
        field: 'endDate',
        message: 'End date must be a valid ISO date',
      });
    }
  }

  // Validate date range
  if (config.startDate && config.endDate) {
    const startDate = DateTime.fromISO(config.startDate);
    const endDate = DateTime.fromISO(config.endDate);

    if (startDate > endDate) {
      errors.push({
        field: 'dateRange',
        message: 'Start date must be before end date',
      });
    }

    // Validate against future dates if preventFutureCommits is true
    if (config.preventFutureCommits !== false) {
      const now = DateTime.now();

      if (endDate > now) {
        errors.push({
          field: 'endDate',
          message: 'End date cannot be in the future when preventFutureCommits is enabled',
        });
      }
    }
  }

  // Validate commitFrequency
  if (config.commitFrequency !== undefined) {
    if (typeof config.commitFrequency !== 'number' || config.commitFrequency <= 0) {
      errors.push({
        field: 'commitFrequency',
        message: 'Commit frequency must be a positive number',
      });
    } else if (config.commitFrequency > 20) {
      errors.push({
        field: 'commitFrequency',
        message: 'Commit frequency exceeds realistic limits (max: 20)',
      });
    }
  }

  // Validate minTimeBetweenCommits
  if (config.minTimeBetweenCommits !== undefined) {
    if (typeof config.minTimeBetweenCommits !== 'number' || config.minTimeBetweenCommits < 0) {
      errors.push({
        field: 'minTimeBetweenCommits',
        message: 'Minimum time between commits must be a non-negative number',
      });
    }
  }

  // Validate holidayCountry
  if (config.respectHolidays && config.holidayCountry) {
    const validCountryCodes = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'CN', 'BR', 'IN'];

    if (!validCountryCodes.includes(config.holidayCountry)) {
      errors.push({
        field: 'holidayCountry',
        message: `Invalid country code. Supported countries: ${validCountryCodes.join(', ')}`,
      });
    }
  }

  // Validate vacation settings
  if (config.simulateVacations) {
    if (config.vacationCount !== undefined &&
        (typeof config.vacationCount !== 'number' || config.vacationCount < 0)) {
      errors.push({
        field: 'vacationCount',
        message: 'Vacation count must be a non-negative number',
      });
    }

    if (config.maxVacationLength !== undefined &&
        (typeof config.maxVacationLength !== 'number' || config.maxVacationLength < 1)) {
      errors.push({
        field: 'maxVacationLength',
        message: 'Maximum vacation length must be a positive number',
      });
    }
  }

  // Validate project lifecycle
  if (config.projectLifecycleSimulation) {
    const validLifecycles = ['startup', 'maintenance', 'active-development', 'none'];

    if (!validLifecycles.includes(config.projectLifecycleSimulation)) {
      errors.push({
        field: 'projectLifecycleSimulation',
        message: `Invalid project lifecycle. Must be one of: ${validLifecycles.join(', ')}`,
      });
    }
  }

  // Check repoPath
  if (config.repoPath !== undefined && typeof config.repoPath !== 'string') {
    errors.push({
      field: 'repoPath',
      message: 'Repository path must be a string',
    });
  }

  // Check custom pattern data
  if (config.pattern === 'custom' && config.customPattern === undefined) {
    errors.push({
      field: 'customPattern',
      message: 'Custom pattern data is required when pattern is set to "custom"',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize configuration by applying defaults and transformations
 * @param config Configuration to normalize
 * @returns Normalized configuration
 */
export function normalizeConfig(config: Partial<GraphifyConfig>): GraphifyConfig {
  // Clone the config to avoid modifying the original
  const normalized = { ...config } as GraphifyConfig;

  // Default values
  normalized.dataFilePath = normalized.dataFilePath || './data.json';
  normalized.repoPath = normalized.repoPath || '.';
  normalized.remoteBranch = normalized.remoteBranch || 'main';
  normalized.commitCount = normalized.commitCount || 100;
  normalized.maxWeeks = normalized.maxWeeks || 52;
  normalized.maxDays = normalized.maxDays || 6;
  normalized.pushToRemote = normalized.pushToRemote !== false;
  normalized.pattern = normalized.pattern || 'random';
  normalized.commitFrequency = normalized.commitFrequency || 1;
  normalized.activeDays = normalized.activeDays || [1, 2, 3, 4, 5];
  normalized.timeOfDay = normalized.timeOfDay || 'working-hours';
  normalized.minTimeBetweenCommits = normalized.minTimeBetweenCommits || 30;
  normalized.useRealisticTimestamps = normalized.useRealisticTimestamps !== false;
  normalized.preventFutureCommits = normalized.preventFutureCommits !== false;
  normalized.validateRealism = normalized.validateRealism !== false;
  normalized.showAnalytics = normalized.showAnalytics !== false;
  normalized.projectLifecycleSimulation = normalized.projectLifecycleSimulation || 'none';

  // Derived values and adjustments
  if (!normalized.startDate) {
    normalized.startDate = DateTime.now().minus({ years: 1 }).toISODate();
  }

  if (!normalized.endDate) {
    normalized.endDate = DateTime.now().toISODate();
  }

  // Default vacations settings
  if (normalized.simulateVacations) {
    normalized.vacationCount = normalized.vacationCount || 2;
    normalized.maxVacationLength = normalized.maxVacationLength || 14;
  }

  // Default holidays settings
  if (normalized.respectHolidays) {
    normalized.holidayCountry = normalized.holidayCountry || 'US';
  }

  // Default development cycle settings
  if (normalized.simulateDevelopmentCycles) {
    normalized.developmentCycleLength = normalized.developmentCycleLength || 14;
  }

  return normalized;
}

/**
 * Perform a deep validation that checks more nuanced rules and realism
 * @param config Configuration to validate
 * @returns Validation result with warnings for potentially unrealistic configurations
 */
export function validateRealism(config: GraphifyConfig): ValidationResult {
  const warnings: ValidationError[] = [];

  // Check for very high commit counts
  if (config.commitCount > 1000) {
    warnings.push({
      field: 'commitCount',
      message: 'Warning: Very high commit count may look suspicious on GitHub',
    });
  }

  // Check commit frequency
  if (config.commitFrequency > 10) {
    warnings.push({
      field: 'commitFrequency',
      message: 'Warning: High commit frequency may look suspicious',
    });
  }

  // Check date range
  const startDate = DateTime.fromISO(config.startDate as string);
  const endDate = DateTime.fromISO(config.endDate as string);
  const daysDiff = endDate.diff(startDate, 'days').days;

  // Calculate commits per day average for active days
  const activeDaysPerWeek = config.activeDays?.length || 5;
  const totalActiveDays = (daysDiff / 7) * activeDaysPerWeek;
  const commitsPerActiveDay = config.commitCount / totalActiveDays;

  if (commitsPerActiveDay > 15) {
    warnings.push({
      field: 'commitCount',
      message: `Warning: Average of ${commitsPerActiveDay.toFixed(1)} commits per active day may look suspicious`,
    });
  }

  // Check for very recent dates with high commit counts
  const now = DateTime.now();
  const daysFromEnd = now.diff(endDate, 'days').days;

  if (daysFromEnd < 7 && config.commitCount > 100) {
    warnings.push({
      field: 'endDate',
      message: 'Warning: High commit count in recent days may look suspicious',
    });
  }

  return {
    isValid: true, // These are warnings, not errors
    errors: warnings,
  };
}
