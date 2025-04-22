import { ErrorHandler, ErrorLevel } from '../utils/errorHandler';

/**
 * Validation rules for different types of data
 */
export interface ValidationRule {
  test: (value: any) => boolean;
  message: string;
}

/**
 * Service for validating input data
 */
export class ValidationService {
  private static readonly SOURCE = 'ValidationService';

  /**
   * Email validation rules
   */
  private static readonly EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  /**
   * URL validation rules
   */
  private static readonly URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
  
  /**
   * GitHub token validation rules
   */
  private static readonly GITHUB_TOKEN_REGEX = /^gh[ps]_[a-zA-Z0-9]{36}$/;
  
  /**
   * GraphQL endpoint validation rules
   */
  private static readonly GRAPHQL_ENDPOINT_REGEX = /^(https?:\/\/)([a-zA-Z0-9][-a-zA-Z0-9_.]*\.)?[a-zA-Z0-9][-a-zA-Z0-9_.]*\.[a-zA-Z]{2,}(:[0-9]{1,5})?(\/[-a-zA-Z0-9_%$.~#?&=]*)*$/;

  /**
   * Validate data against a set of rules
   * @param value Value to validate
   * @param rules Validation rules to apply
   * @param description Description of what's being validated
   * @returns True if valid, false otherwise
   */
  public static validate(value: any, rules: ValidationRule[], description: string): boolean {
    for (const rule of rules) {
      if (!rule.test(value)) {
        ErrorHandler.handle(
          `Invalid ${description}: ${rule.message}`,
          this.SOURCE,
          ErrorLevel.WARNING
        );
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if a string is not empty
   * @param value String to check
   * @param description Description of what's being validated
   * @returns True if not empty, false otherwise
   */
  public static isNotEmpty(value: string, description: string): boolean {
    const rules: ValidationRule[] = [
      {
        test: (val) => typeof val === 'string' && val.trim().length > 0,
        message: 'Value cannot be empty'
      }
    ];
    
    return this.validate(value, rules, description);
  }

  /**
   * Check if a value is within a range
   * @param value Numeric value to check
   * @param min Minimum allowed value
   * @param max Maximum allowed value
   * @param description Description of what's being validated
   * @returns True if within range, false otherwise
   */
  public static isInRange(value: number, min: number, max: number, description: string): boolean {
    const rules: ValidationRule[] = [
      {
        test: (val) => typeof val === 'number' && !isNaN(val),
        message: 'Value must be a number'
      },
      {
        test: (val) => val >= min && val <= max,
        message: `Value must be between ${min} and ${max}`
      }
    ];
    
    return this.validate(value, rules, description);
  }

  /**
   * Check if a value is a valid email address
   * @param value Email address to check
   * @returns True if valid, false otherwise
   */
  public static isEmail(value: string): boolean {
    const rules: ValidationRule[] = [
      {
        test: (val) => typeof val === 'string',
        message: 'Email must be a string'
      },
      {
        test: (val) => this.EMAIL_REGEX.test(val),
        message: 'Email format is invalid'
      }
    ];
    
    return this.validate(value, rules, 'email');
  }

  /**
   * Check if a value is a valid URL
   * @param value URL to check
   * @returns True if valid, false otherwise
   */
  public static isUrl(value: string): boolean {
    const rules: ValidationRule[] = [
      {
        test: (val) => typeof val === 'string',
        message: 'URL must be a string'
      },
      {
        test: (val) => this.URL_REGEX.test(val),
        message: 'URL format is invalid'
      }
    ];
    
    return this.validate(value, rules, 'URL');
  }

  /**
   * Check if a value is a valid GitHub token
   * @param value GitHub token to check
   * @returns True if valid, false otherwise
   */
  public static isGitHubToken(value: string): boolean {
    const rules: ValidationRule[] = [
      {
        test: (val) => typeof val === 'string',
        message: 'GitHub token must be a string'
      },
      {
        test: (val) => this.GITHUB_TOKEN_REGEX.test(val),
        message: 'GitHub token format is invalid. It should start with ghs_ or ghp_ followed by 36 characters.'
      }
    ];
    
    return this.validate(value, rules, 'GitHub token');
  }

  /**
   * Check if a value is a valid GraphQL endpoint
   * @param value GraphQL endpoint to check
   * @returns True if valid, false otherwise
   */
  public static isGraphQLEndpoint(value: string): boolean {
    const rules: ValidationRule[] = [
      {
        test: (val) => typeof val === 'string',
        message: 'GraphQL endpoint must be a string'
      },
      {
        test: (val) => this.GRAPHQL_ENDPOINT_REGEX.test(val),
        message: 'GraphQL endpoint format is invalid'
      }
    ];
    
    return this.validate(value, rules, 'GraphQL endpoint');
  }

  /**
   * Check if a value is one of the allowed options
   * @param value Value to check
   * @param options Allowed options
   * @param description Description of what's being validated
   * @returns True if valid, false otherwise
   */
  public static isOneOf<T>(value: T, options: T[], description: string): boolean {
    const rules: ValidationRule[] = [
      {
        test: (val) => options.includes(val),
        message: `Value must be one of: ${options.join(', ')}`
      }
    ];
    
    return this.validate(value, rules, description);
  }

  /**
   * Check if an object has all required properties
   * @param obj Object to check
   * @param requiredProps Required property names
   * @param description Description of what's being validated
   * @returns True if valid, false otherwise
   */
  public static hasRequiredProperties(
    obj: Record<string, any>, 
    requiredProps: string[], 
    description: string
  ): boolean {
    if (typeof obj !== 'object' || obj === null) {
      ErrorHandler.handle(
        `Invalid ${description}: Must be an object`,
        this.SOURCE,
        ErrorLevel.WARNING
      );
      return false;
    }

    const missingProps = requiredProps.filter(prop => !(prop in obj));
    
    if (missingProps.length > 0) {
      ErrorHandler.handle(
        `Invalid ${description}: Missing required properties: ${missingProps.join(', ')}`,
        this.SOURCE,
        ErrorLevel.WARNING
      );
      return false;
    }
    
    return true;
  }
} 