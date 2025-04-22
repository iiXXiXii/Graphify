import Conf from 'conf';

/**
 * Manages user preferences and settings
 */
export class UserPreferences {
  private static instance: UserPreferences;
  private config: Conf;

  /**
   * Creates a new UserPreferences instance or returns the existing one
   */
  constructor() {
    if (UserPreferences.instance) {
      return UserPreferences.instance;
    }

    this.config = new Conf({
      projectName: 'graphify',
      defaults: {
        recentRepos: [],
        patterns: [
          {
            name: 'standard',
            description: 'Standard pattern with uniform distribution',
            isDefault: true
          },
          {
            name: 'realistic',
            description: 'Realistic pattern with weekday concentration',
            isDefault: false
          },
          {
            name: 'random',
            description: 'Random distribution of commits',
            isDefault: false
          }
        ],
        defaultPattern: 'standard',
        theme: 'default',
        commitMessageStyle: 'conventional',
        maxCommitsPerDay: 5,
        workingHours: {
          start: 9,
          end: 18
        }
      }
    });

    UserPreferences.instance = this;
  }

  /**
   * Get the singleton instance
   * @returns The UserPreferences instance
   */
  public static getInstance(): UserPreferences {
    if (!UserPreferences.instance) {
      UserPreferences.instance = new UserPreferences();
    }
    return UserPreferences.instance;
  }

  /**
   * Get a preference value
   * @param key The preference key
   * @param defaultValue Optional default value if key doesn't exist
   * @returns The preference value or default value
   */
  public get<T>(key: string, defaultValue?: T): T {
    return this.config.get(key, defaultValue) as T;
  }

  /**
   * Set a preference value
   * @param key The preference key
   * @param value The value to set
   */
  public set<T>(key: string, value: T): void {
    this.config.set(key, value);
  }

  /**
   * Get recent repositories
   * @returns Array of recent repositories
   */
  public getRecentRepos(): string[] {
    return this.config.get('recentRepos', []) as string[];
  }

  /**
   * Add a repository to recent repos
   * @param repoPath Repository path to add
   * @param limit Maximum number of repos to keep (defaults to 10)
   */
  public addRecentRepo(repoPath: string, limit = 10): void {
    const recentRepos = this.getRecentRepos().filter(repo => repo !== repoPath);
    recentRepos.unshift(repoPath);

    // Trim to limit
    if (recentRepos.length > limit) {
      recentRepos.length = limit;
    }

    this.config.set('recentRepos', recentRepos);
  }

  /**
   * Get all available patterns
   * @returns Array of pattern configurations
   */
  public getPatterns(): Array<{name: string, description: string, isDefault: boolean}> {
    return this.config.get('patterns') as Array<{name: string, description: string, isDefault: boolean}>;
  }

  /**
   * Get a specific pattern by name
   * @param name Pattern name
   * @returns Pattern config or undefined if not found
   */
  public getPattern(name: string): {name: string, description: string, isDefault: boolean} | undefined {
    const patterns = this.getPatterns();
    return patterns.find(pattern => pattern.name === name);
  }

  /**
   * Get the default pattern name
   * @returns Default pattern name
   */
  public getDefaultPattern(): string {
    return this.config.get('defaultPattern') as string;
  }

  /**
   * Set the default pattern
   * @param patternName Pattern name to set as default
   */
  public setDefaultPattern(patternName: string): void {
    const patterns = this.getPatterns();
    const patternExists = patterns.some(p => p.name === patternName);

    if (!patternExists) {
      throw new Error(`Pattern '${patternName}' does not exist`);
    }

    // Update the default pattern
    this.config.set('defaultPattern', patternName);

    // Update isDefault flag in patterns
    const updatedPatterns = patterns.map(pattern => ({
      ...pattern,
      isDefault: pattern.name === patternName
    }));

    this.config.set('patterns', updatedPatterns);
  }
}
