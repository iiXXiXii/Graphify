/**
 * Utility for generating realistic commit messages
 */
export class CommitMessageGenerator {
  /** Common commit message prefixes */
  private static readonly PREFIXES = [
    'Add',
    'Update',
    'Fix',
    'Refactor',
    'Implement',
    'Remove',
    'Clean up',
    'Optimize',
    'Improve',
    'Revise',
    'Enhance',
    'Modify',
    'Migrate',
    'Revert',
    'Simplify',
    'Initialize',
    'Introduce',
    'Correct',
    'Adjust',
    'Extract',
    'Resolve',
    'Bump',
    'Merge'
  ];

  /** Common code elements */
  private static readonly CODE_ELEMENTS = [
    'component',
    'class',
    'function',
    'method',
    'test',
    'module',
    'interface',
    'type',
    'service',
    'utility',
    'controller',
    'model',
    'view',
    'middleware',
    'hook',
    'helper',
    'config',
    'style',
    'schema',
    'dependency',
    'API integration',
    'documentation',
    'error handling',
    'validation',
    'authentication',
    'authorization',
    'logging',
    'performance',
    'security feature',
    'build process',
    'CI pipeline',
    'deployment script'
  ];

  /** Common bug types */
  private static readonly BUG_TYPES = [
    'bug',
    'issue',
    'error',
    'crash',
    'memory leak',
    'race condition',
    'edge case',
    'regression',
    'overflow',
    'underflow',
    'null pointer',
    'undefined reference',
    'type error',
    'syntax error',
    'runtime error',
    'timeout',
    'performance issue',
    'security vulnerability'
  ];

  /** Common file extensions */
  private static readonly FILE_EXTENSIONS = [
    '.ts',
    '.js',
    '.tsx',
    '.jsx',
    '.css',
    '.scss',
    '.json',
    '.md',
    '.html',
    '.yml',
    '.xml',
    '.graphql',
    '.sh',
    '.conf'
  ];

  /** Common locations */
  private static readonly LOCATIONS = [
    'in',
    'for',
    'when',
    'from',
    'to',
    'within',
    'during',
    'after',
    'before'
  ];

  /** Common contexts */
  private static readonly CONTEXTS = [
    'login flow',
    'sign-up process',
    'checkout page',
    'dashboard',
    'navigation',
    'mobile view',
    'desktop layout',
    'API responses',
    'error states',
    'loading states',
    'unit tests',
    'integration tests',
    'production build',
    'development environment',
    'staging environment',
    'user profile',
    'authentication flow',
    'form validation',
    'data loading',
    'state management'
  ];

  /**
   * Generate a random commit message
   * @returns Random commit message
   */
  static generateMessage(): string {
    const random = Math.random();
    
    if (random < 0.4) {
      // Feature or improvement
      return this.generateFeatureMessage();
    } else if (random < 0.7) {
      // Bug fix
      return this.generateBugFixMessage();
    } else if (random < 0.85) {
      // Refactoring or cleanup
      return this.generateRefactoringMessage();
    } else {
      // Documentation or misc
      return this.generateMiscMessage();
    }
  }

  /**
   * Generate a random feature or improvement message
   * @returns Random feature message
   */
  private static generateFeatureMessage(): string {
    const prefix = this.getRandomItem(this.PREFIXES.filter(p => 
      ['Add', 'Update', 'Implement', 'Introduce', 'Enhance', 'Improve'].includes(p)));
    const element = this.getRandomItem(this.CODE_ELEMENTS);
    const hasFor = Math.random() > 0.5;
    
    if (hasFor) {
      const context = this.getRandomItem(this.CONTEXTS);
      return `${prefix} ${element} for ${context}`;
    } else {
      // Sometimes add specific file names
      const hasFileName = Math.random() > 0.7;
      if (hasFileName) {
        const name = this.generateFileName();
        return `${prefix} ${element} in ${name}`;
      } else {
        return `${prefix} ${element}`;
      }
    }
  }

  /**
   * Generate a random bug fix message
   * @returns Random bug fix message
   */
  private static generateBugFixMessage(): string {
    const prefix = this.getRandomItem(['Fix', 'Resolve', 'Correct', 'Address']);
    const bug = this.getRandomItem(this.BUG_TYPES);
    const location = this.getRandomItem(this.LOCATIONS);
    const context = this.getRandomItem(this.CONTEXTS);
    
    // Sometimes specify what was fixed
    const hasWhat = Math.random() > 0.5;
    if (hasWhat) {
      return `${prefix} ${bug} ${location} ${context}`;
    } else {
      return `${prefix} ${bug}`;
    }
  }

  /**
   * Generate a random refactoring message
   * @returns Random refactoring message
   */
  private static generateRefactoringMessage(): string {
    const prefix = this.getRandomItem(['Refactor', 'Clean up', 'Simplify', 'Optimize', 'Restructure']);
    const element = this.getRandomItem(this.CODE_ELEMENTS);
    
    // Sometimes specify what was refactored
    const hasWhat = Math.random() > 0.6;
    if (hasWhat) {
      const fileName = this.generateFileName();
      return `${prefix} ${element} in ${fileName}`;
    } else {
      return `${prefix} ${element}`;
    }
  }

  /**
   * Generate a random miscellaneous message
   * @returns Random misc message
   */
  private static generateMiscMessage(): string {
    const types = [
      'Update README',
      'Add documentation',
      'Update dependencies',
      'Bump version',
      'Update changelog',
      'Fix typo',
      'Remove unused code',
      'Update license',
      'Clean up whitespace',
      'Merge branch',
      'Update gitignore',
      'Add example',
      'Update tests',
      'Improve error messages',
      'Update config',
      'Refine styling'
    ];
    
    return this.getRandomItem(types);
  }

  /**
   * Generate a realistic file name
   * @returns Random file name
   */
  private static generateFileName(): string {
    const prefixes = [
      'user',
      'auth',
      'config',
      'api',
      'util',
      'model',
      'view',
      'component',
      'service',
      'helper',
      'test',
      'common',
      'app',
      'data',
      'store',
      'index',
      'main',
      'interface',
      'types',
      'constants'
    ];
    
    const prefix = this.getRandomItem(prefixes);
    const extension = this.getRandomItem(this.FILE_EXTENSIONS);
    
    // Sometimes add folder structure
    const hasFolders = Math.random() > 0.6;
    if (hasFolders) {
      const folders = ['src', 'app', 'components', 'utils', 'models', 'services', 'hooks', 'helpers', 'pages', 'tests'];
      const folderCount = Math.floor(Math.random() * 2) + 1;
      const selectedFolders: string[] = [];
      
      for (let i = 0; i < folderCount; i++) {
        const folder = this.getRandomItem(folders);
        if (!selectedFolders.includes(folder)) {
          selectedFolders.push(folder);
        }
      }
      
      return `${selectedFolders.join('/')}/${prefix}${extension}`;
    } else {
      return `${prefix}${extension}`;
    }
  }

  /**
   * Get a random item from an array
   * @param items Array of items
   * @returns Random item
   */
  private static getRandomItem<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Generate multiple unique commit messages
   * @param count Number of messages to generate
   * @returns Array of unique commit messages
   */
  static generateMultiple(count: number): string[] {
    const messages = new Set<string>();
    
    while (messages.size < count) {
      messages.add(this.generateMessage());
    }
    
    return Array.from(messages);
  }

  /**
   * Generate a commit message from provided templates
   * @param templates Array of message templates
   * @returns A message selected from templates
   */
  static generateFromTemplates(templates: string[]): string {
    if (!templates || templates.length === 0) {
      return this.generateMessage();
    }
    
    return this.getRandomItem(templates);
  }
} 