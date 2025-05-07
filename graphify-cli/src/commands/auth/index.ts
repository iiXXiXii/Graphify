import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import { authenticateWithGitHub, logout, getStorageLocation } from '../auth';

/**
 * Authentication module for Graphify CLI
 * Handles GitHub authentication via Personal Access Token
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Configuration constants
const CONFIG_DIR = path.join(os.homedir(), '.graphify');
const AUTH_FILE = path.join(CONFIG_DIR, 'auth.json');
const GITHUB_API = 'https://api.github.com';

/**
 * Authentication configuration interface
 */
interface AuthConfig {
  token: string;
  username: string;
  email: string;
  lastVerified?: string;
}

/**
 * User information returned from GitHub API
 */
interface GitHubUser {
  login: string;
  email: string | null;
}

/**
 * Ensure configuration directory exists
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Save authentication config to disk
 * @param config Authentication configuration
 */
function saveAuthConfig(config: AuthConfig): void {
  ensureConfigDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(config, null, 2));
}

/**
 * Load authentication config from disk
 * @returns Saved authentication config or null if not found
 */
export function loadAuthConfig(): AuthConfig | null {
  if (!fs.existsSync(AUTH_FILE)) {
    return null;
  }

  try {
    const data = fs.readFileSync(AUTH_FILE, 'utf-8');
    return JSON.parse(data) as AuthConfig;
  } catch (error) {
    console.error('Error loading authentication configuration:', error);
    return null;
  }
}

/**
 * Validate GitHub personal access token by making an API call
 * @param token GitHub Personal Access Token
 * @returns User information if valid, null otherwise
 */
export async function validateGitHubToken(token: string): Promise<GitHubUser | null> {
  try {
    // Make request to GitHub API to verify token
    const response = await fetch(`${GITHUB_API}/user`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Ensure we have a valid user object
    if (data && data.login) {
      return {
        login: data.login,
        email: data.email || null
      };
    }

    return null;
  } catch (error) {
    console.error('Error validating GitHub token:', error);
    return null;
  }
}

/**
 * Set up authentication with GitHub token
 * @param token GitHub Personal Access Token
 * @returns Success status and message
 */
export async function authenticate(token: string): Promise<{ success: boolean; message: string }> {
  try {
    const user = await validateGitHubToken(token);

    if (!user) {
      return {
        success: false,
        message: 'Invalid GitHub token. Please check your token and try again.'
      };
    }

    // Try to get email if not provided by API
    let email = user.email;
    if (!email) {
      try {
        // Try to use git config for email
        email = execSync('git config --global user.email').toString().trim();
      } catch (err) {
        // Use placeholder if we can't get an email
        email = `${user.login}@users.noreply.github.com`;
      }
    }

    // Save authentication information
    const config: AuthConfig = {
      token,
      username: user.login,
      email,
      lastVerified: new Date().toISOString()
    };

    saveAuthConfig(config);

    return {
      success: true,
      message: `Successfully authenticated as ${user.login}`
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check if user is currently authenticated
 * @returns True if authenticated
 */
export function isAuthenticated(): boolean {
  const config = loadAuthConfig();
  return config !== null && !!config.token;
}

/**
 * Log out by removing saved authentication
 * @returns Success status and message
 */
export function logout(): { success: boolean; message: string } {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE);
      return {
        success: true,
        message: 'Successfully logged out'
      };
    }
    return {
      success: false,
      message: 'Not currently authenticated'
    };
  } catch (error) {
    return {
      success: false,
      message: `Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Get currently authenticated user information
 * @returns User information or null if not authenticated
 */
export function getCurrentUser(): { username: string; email: string } | null {
  const config = loadAuthConfig();
  if (!config) {
    return null;
  }

  return {
    username: config.username,
    email: config.email
  };
}

/**
 * Get authenticated user's GitHub token
 * @returns GitHub token or null if not authenticated
 */
export function getAuthToken(): string | null {
  const config = loadAuthConfig();
  return config?.token || null;
}

export default class Auth extends Command {
  static description = 'Authenticate with GitHub or manage authentication';

  static examples = [
    '$ graphify auth',
    '$ graphify auth --logout',
    '$ graphify auth --status',
  ];

  static flags = {
    logout: Flags.boolean({
      char: 'l',
      description: 'Logout and remove stored credentials',
      exclusive: ['status'],
    }),
    status: Flags.boolean({
      char: 's',
      description: 'Check current authentication status',
      exclusive: ['logout'],
    }),
  };

  async run() {
    const { flags } = await this.parse(Auth);

    try {
      if (flags.logout) {
        await this.handleLogout();
      } else if (flags.status) {
        await this.handleStatus();
      } else {
        await this.handleLogin();
      }
    } catch (error) {
      this.error(chalk.red(`Authentication error: ${error.message}`));
    }
  }

  private async handleLogin() {
    try {
      // First check if we're already authenticated
      try {
        const status = await this.checkAuthStatus();
        if (status.isAuthenticated) {
          this.log(chalk.green(`✓ Already authenticated`));
          const { reauth } = await inquirer.prompt({
            type: 'confirm',
            name: 'reauth',
            message: 'Do you want to re-authenticate?',
            default: false,
          });

          if (!reauth) {
            return;
          }
        }
      } catch (e) {
        // Not authenticated, continue with login flow
      }

      this.log(chalk.blue('Starting GitHub authentication...'));

      // Check for environment variables
      if (!process.env.GITHUB_CLIENT_ID) {
        this.log(chalk.yellow('⚠️  GITHUB_CLIENT_ID environment variable not set.'));
        this.log(chalk.yellow('Using default client ID. This may have limited capabilities.'));
      }

      await authenticateWithGitHub();

      this.log(chalk.green('\n✓ Authentication successful!'));
      this.log(`Token stored in ${getStorageLocation()}`);
    } catch (error) {
      this.error(chalk.red(`Authentication failed: ${error.message}`));
    }
  }

  private async handleLogout() {
    try {
      await logout();
      this.log(chalk.green('✓ Successfully logged out'));
    } catch (error) {
      this.error(chalk.red(`Logout failed: ${error.message}`));
    }
  }

  private async handleStatus() {
    try {
      const status = await this.checkAuthStatus();

      if (status.isAuthenticated) {
        this.log(chalk.green('✓ Authenticated with GitHub'));
        this.log(`Token stored in: ${status.storage}`);
        if (status.scopes) {
          this.log(`Available permissions: ${status.scopes.join(', ')}`);
        }
        if (status.expiresAt) {
          this.log(`Token expires: ${new Date(status.expiresAt).toLocaleString()}`);
        }
      } else {
        this.log(chalk.yellow('✗ Not authenticated with GitHub'));
        this.log('Run "graphify auth" to authenticate');
      }
    } catch (error) {
      this.log(chalk.yellow('✗ Not authenticated with GitHub'));
      this.log(`Error checking status: ${error.message}`);
    }
  }

  private async checkAuthStatus(): Promise<{
    isAuthenticated: boolean;
    storage: string;
    scopes?: string[];
    expiresAt?: number;
  }> {
    try {
      // Import these dynamically to avoid circular dependencies
      const { getAuthToken, loadAuthData } = require('../auth');

      // Try to get the token - this will throw if not authenticated
      await getAuthToken();

      // Get additional auth data if available
      const authData = loadAuthData ? await loadAuthData() : null;

      return {
        isAuthenticated: true,
        storage: getStorageLocation(),
        scopes: authData?.scope,
        expiresAt: authData?.expiresAt,
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        storage: 'none',
      };
    }
  }
}
