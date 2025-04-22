import path from 'path';
import os from 'os';
import fs from 'fs';
import Conf from 'conf';
import { UserPreferences } from '../types/config';

// User configuration file location
const USER_CONFIG_DIR = path.join(os.homedir(), '.graphify');
const USER_CONFIG_FILE = path.join(USER_CONFIG_DIR, 'config.json');

// Create config directory if it doesn't exist
if (!fs.existsSync(USER_CONFIG_DIR)) {
  fs.mkdirSync(USER_CONFIG_DIR, { recursive: true });
}

// Set up configuration store
const configStore = new Conf<UserPreferences>({
  projectName: 'graphify',
  // Use schema for validation but keep it in TypeScript
  schema: {
    pattern: {
      type: 'string',
      enum: ['random', 'gradient', 'snake', 'heart', 'realistic', 'steady', 'crescendo', 'custom'],
    },
    commitCount: {
      type: 'number',
      minimum: 1,
    },
    commitFrequency: {
      type: 'number',
      minimum: 1,
    },
    repoPath: {
      type: 'string',
    },
    remoteBranch: {
      type: 'string',
    },
    pushToRemote: {
      type: 'boolean',
    },
    activeDays: {
      type: 'array',
      items: {
        type: 'number',
        minimum: 0,
        maximum: 6,
      },
    },
    timeOfDay: {
      type: 'string',
      enum: ['morning', 'afternoon', 'evening', 'night', 'random', 'working-hours', 'after-hours'],
    },
    simulateVacations: {
      type: 'boolean',
    },
    respectHolidays: {
      type: 'boolean',
    },
    validateRealism: {
      type: 'boolean',
    },
    githubToken: {
      type: 'string',
    },
    ui: {
      type: 'object',
      properties: {
        advancedMode: { type: 'boolean' },
        showAnalytics: { type: 'boolean' },
        colorTheme: { 
          type: 'string',
          enum: ['light', 'dark', 'system'],
        },
      },
    },
  },
});

/**
 * Get default user configuration
 * @returns Default configuration
 */
function getDefaultUserConfig(): UserPreferences {
  return {
    pattern: 'random',
    commitCount: 100,
    commitFrequency: 1,
    repoPath: '.',
    remoteBranch: 'main',
    pushToRemote: true,
    activeDays: [1, 2, 3, 4, 5], // Monday to Friday
    timeOfDay: 'working-hours',
    simulateVacations: false,
    respectHolidays: false,
    validateRealism: true,
    ui: {
      advancedMode: false,
      showAnalytics: true,
      colorTheme: 'system',
    },
  };
}

/**
 * Load user configuration from file
 * @returns User configuration with defaults applied
 */
export function loadUserConfig(): UserPreferences {
  // Merge defaults with user-saved preferences
  return {
    ...getDefaultUserConfig(),
    ...configStore.store,
  };
}

/**
 * Save user configuration to file
 * @param config User configuration to save
 */
export function saveUserConfig(config: Partial<UserPreferences>): void {
  try {
    // Get existing config
    const existingConfig = configStore.store;
    
    // Merge with new config
    const updatedConfig = {
      ...existingConfig,
      ...config,
    };
    
    // Save only changed values
    Object.entries(updatedConfig).forEach(([key, value]) => {
      if (value !== undefined) {
        configStore.set(key as any, value);
      }
    });
  } catch (error) {
    console.error('Error saving user configuration:', error);
  }
}

/**
 * Reset user configuration to defaults
 */
export function resetUserConfig(): void {
  try {
    configStore.clear();
  } catch (error) {
    console.error('Error resetting user configuration:', error);
  }
}

/**
 * Save GitHub API token securely
 * @param token GitHub API token
 */
export function saveGitHubToken(token: string): void {
  try {
    configStore.set('githubToken', token);
  } catch (error) {
    console.error('Error saving GitHub token:', error);
  }
}

/**
 * Get GitHub API token
 * @returns GitHub API token or undefined if not set
 */
export function getGitHubToken(): string | undefined {
  return configStore.get('githubToken');
}

/**
 * Check if user configuration exists
 * @returns True if user has saved configuration
 */
export function hasUserConfig(): boolean {
  return Object.keys(configStore.store).length > 0;
}

/**
 * Export config to a JSON file
 * @param filePath Path to save configuration
 * @returns True if successful
 */
export function exportConfig(filePath: string): boolean {
  try {
    const config = loadUserConfig();
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error exporting configuration:', error);
    return false;
  }
}

/**
 * Import config from a JSON file
 * @param filePath Path to load configuration from
 * @returns True if successful
 */
export function importConfig(filePath: string): boolean {
  try {
    const configData = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(configData) as UserPreferences;
    saveUserConfig(config);
    return true;
  } catch (error) {
    console.error('Error importing configuration:', error);
    return false;
  }
} 