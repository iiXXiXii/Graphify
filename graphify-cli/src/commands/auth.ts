import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import chalk from 'chalk';
import { Command, Flags } from '@oclif/core';
import * as inquirer from 'inquirer';
import * as https from 'https';
import * as readline from 'readline';

// Path for storing auth configuration
const CONFIG_DIR = path.join(os.homedir(), '.graphify');
const TOKEN_FILE = path.join(CONFIG_DIR, 'auth.json');
const ENCRYPTION_KEY = process.env.GRAPHIFY_ENCRYPTION_KEY || 'default-encryption-key';

interface AuthData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string[];
}

// In-memory token storage - this won't persist across sessions
// Only used when encryption isn't possible
let inMemoryToken: string | null = null;

// Encrypt sensitive data
function encrypt(text: string): { iv: string, content: string } {
  try {
    // Create a unique initialization vector for each encryption
    const iv = crypto.randomBytes(16);
    // Create a cipher using our encryption key and IV
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('base64').substr(0, 32)),
      iv
    );

    // Encrypt the data
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      iv: iv.toString('hex'),
      content: encrypted
    };
  } catch (error) {
    console.error('Encryption failed, falling back to in-memory storage');
    return { iv: '', content: '' };
  }
}

// Decrypt sensitive data
function decrypt(encrypted: { iv: string, content: string }): string {
  try {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('base64').substr(0, 32)),
      iv
    );

    let decrypted = decipher.update(encrypted.content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed');
    throw new Error('Failed to decrypt authentication token. You may need to log in again.');
  }
}

// Save auth data securely to file
function saveAuthData(authData: AuthData): boolean {
  try {
    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 }); // Set secure permissions
    }

    // Encrypt the token data
    const encryptedData = encrypt(JSON.stringify(authData));

    // If encryption failed, store in memory only
    if (!encryptedData.iv) {
      inMemoryToken = authData.accessToken;
      return false;
    }

    // Write to file
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(encryptedData), {
      encoding: 'utf8',
      mode: 0o600 // Read/write for user only
    });

    return true;
  } catch (error) {
    console.error('Failed to save auth data to disk');
    inMemoryToken = authData.accessToken;
    return false;
  }
}

// Load auth data from secure storage
function loadAuthData(): AuthData | null {
  try {
    if (!fs.existsSync(TOKEN_FILE)) {
      return null;
    }

    const encryptedData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    const decrypted = decrypt(encryptedData);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to load auth data from disk');
    return null;
  }
}

// Check if token has expired
function isTokenExpired(authData: AuthData): boolean {
  if (!authData.expiresAt) return false;

  // Add a 5-minute buffer to be safe
  return Date.now() > (authData.expiresAt - 5 * 60 * 1000);
}

// Get a valid auth token, refreshing if necessary
export async function getAuthToken(): Promise<string> {
  // Check in-memory token first
  if (inMemoryToken) {
    return inMemoryToken;
  }

  // Try to load from file
  const authData = loadAuthData();

  if (!authData) {
    throw new Error('Not authenticated. Please log in first using "graphify auth".');
  }

  // Check if token has expired
  if (isTokenExpired(authData) && authData.refreshToken) {
    // Refresh the token (would require implementation)
    // For now, we'll just force a new login
    throw new Error('Authentication expired. Please log in again using "graphify auth".');
  }

  return authData.accessToken;
}

export async function authenticateWithGitHub(): Promise<void> {
  // Check for required environment variables
  if (!process.env.GITHUB_CLIENT_ID) {
    throw new Error('GitHub Client ID is not set. Please set GITHUB_CLIENT_ID environment variable.');
  }

  console.log('Starting GitHub authentication...');

  // Create OAuth device auth flow
  const auth = createOAuthDeviceAuth({
    clientType: 'oauth-app',
    clientId: process.env.GITHUB_CLIENT_ID,
    scopes: ['repo'], // Request minimal permissions needed
    onVerification: ({ verification_uri, user_code }) => {
      console.log('\nComplete your authentication in your browser:');
      console.log(`1. Open: ${verification_uri}`);
      console.log(`2. Enter code: ${user_code}`);
      console.log('\nWaiting for authentication...');
    },
  });

  try {
    // Start auth flow
    const { token, scopes, expiresAt } = await auth({ type: 'oauth' });

    // Create auth data object
    const authData: AuthData = {
      accessToken: token,
      scope: scopes,
      expiresAt: expiresAt?.getTime()
    };

    // Save token securely
    const savedToFile = saveAuthData(authData);

    console.log('\nAuthentication successful!');
    if (savedToFile) {
      console.log(`Token securely stored in ${TOKEN_FILE}`);
    } else {
      console.log('Token stored in memory only. It will be lost when you close this program.');
    }

    return;
  } catch (error) {
    console.error('\nAuthentication failed:', error.message);
    throw new Error(`GitHub authentication failed: ${error.message}`);
  }
}

export function getStorageLocation(): string {
  if (inMemoryToken) {
    return 'in-memory (temporary)';
  }

  return TOKEN_FILE;
}

export async function logout(): Promise<void> {
  try {
    // Clear in-memory token
    inMemoryToken = null;

    // Delete token file if it exists
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }

    console.log('Successfully logged out from GitHub.');
  } catch (error) {
    console.error('Error during logout:', error.message);
    throw new Error(`Logout failed: ${error.message}`);
  }
}

export interface AuthConfig {
  token: string;
  username?: string;
  created: string;
  scopes?: string[];
}

export default class Auth extends Command {
  static description = 'Authenticate with GitHub';

  static examples = [
    '$ graphify auth',
    '$ graphify auth --token ghp_YOUR_TOKEN',
    '$ graphify auth --logout',
  ];

  static flags = {
    token: Flags.string({
      char: 't',
      description: 'GitHub Personal Access Token',
      required: false,
    }),
    logout: Flags.boolean({
      char: 'l',
      description: 'Log out and remove saved authentication',
      required: false,
      default: false,
    }),
    check: Flags.boolean({
      char: 'c',
      description: 'Check current authentication status',
      required: false,
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Auth);

    try {
      if (flags.check) {
        await this.checkAuthStatus();
      } else if (flags.logout) {
        await this.logout();
      } else if (flags.token) {
        await this.authenticateWithToken(flags.token);
      } else {
        await this.interactiveAuth();
      }
    } catch (error) {
      this.error(chalk.red(`Authentication error: ${error.message}`));
    }
  }

  /**
   * Check and display current authentication status
   */
  private async checkAuthStatus(): Promise<void> {
    const authConfig = await this.loadAuthConfig();

    if (authConfig) {
      const { username, created, scopes } = authConfig;

      this.log(chalk.green('✓ You are authenticated with GitHub'));

      if (username) {
        this.log(`Username: ${chalk.bold(username)}`);
      }

      if (created) {
        const createdDate = new Date(created);
        this.log(`Authenticated since: ${chalk.bold(createdDate.toLocaleString())}`);
      }

      if (scopes && scopes.length > 0) {
        this.log(`Token scopes: ${chalk.bold(scopes.join(', '))}`);
      }

      // Check token validity
      try {
        const isValid = await this.validateToken(authConfig.token);
        if (isValid) {
          this.log(chalk.green('✓ Token is valid'));
        } else {
          this.log(chalk.yellow('⚠ Token is invalid or expired'));
        }
      } catch (error) {
        this.log(chalk.red('⚠ Could not verify token: ') + error.message);
      }
    } else {
      this.log(chalk.yellow('You are not authenticated with GitHub'));
      this.log(`Run ${chalk.bold('graphify auth')} to authenticate.`);
    }
  }

  /**
   * Interactive authentication flow
   */
  private async interactiveAuth(): Promise<void> {
    // Check if already authenticated
    const existingAuth = await this.loadAuthConfig();
    if (existingAuth) {
      this.log(chalk.yellow('You are already authenticated with GitHub.'));

      const { shouldReauthenticate } = await inquirer.prompt({
        type: 'confirm',
        name: 'shouldReauthenticate',
        message: 'Do you want to re-authenticate?',
        default: false,
      });

      if (!shouldReauthenticate) {
        return;
      }
    }

    this.log(chalk.blue('GitHub Authentication'));
    this.log('To create a GitHub contribution pattern, you need to authenticate with GitHub.');
    this.log('');
    this.log('You need to create a Personal Access Token (classic) with the following scopes:');
    this.log(`- ${chalk.green('repo')} - to create commits in your repositories`);
    this.log('');
    this.log(`Create a token here: ${chalk.blue('https://github.com/settings/tokens/new')}`);
    this.log('');

    const { tokenInput } = await inquirer.prompt({
      type: 'password',
      name: 'tokenInput',
      message: 'Enter your GitHub Personal Access Token:',
    });

    if (!tokenInput) {
      throw new Error('No token provided. Authentication cancelled.');
    }

    await this.authenticateWithToken(tokenInput);
  }

  /**
   * Authenticate using a provided token
   */
  private async authenticateWithToken(token: string): Promise<void> {
    this.log(chalk.blue('Validating GitHub token...'));

    try {
      // Validate token by making a request to the GitHub API
      const userInfo = await this.getUserInfo(token);

      if (!userInfo || !userInfo.login) {
        throw new Error('Invalid token or GitHub API error');
      }

      // Get token scopes
      const tokenScopes = await this.getTokenScopes(token);

      // Save token to config file
      const authConfig: AuthConfig = {
        token: token,
        username: userInfo.login,
        created: new Date().toISOString(),
        scopes: tokenScopes,
      };

      await this.saveAuthConfig(authConfig);

      this.log(chalk.green(`✓ Authenticated as ${chalk.bold(userInfo.login)}`));

      // Check for permissions
      if (tokenScopes && !tokenScopes.includes('repo')) {
        this.log(chalk.yellow('⚠ Warning: Token does not have the "repo" scope.'));
        this.log(chalk.yellow('Some operations that require repository access may fail.'));
      }
    } catch (error) {
      throw new Error(`GitHub authentication failed: ${error.message}`);
    }
  }

  /**
   * Logout and remove authentication data
   */
  private async logout(): Promise<void> {
    try {
      // Check if authenticated
      const authExists = existsSync(TOKEN_FILE);

      if (!authExists) {
        this.log(chalk.yellow('You are not currently authenticated.'));
        return;
      }

      // Remove token file
      await fs.unlink(TOKEN_FILE);
      this.log(chalk.green('✓ Successfully logged out'));
    } catch (error) {
      throw new Error(`Failed to logout: ${error.message}`);
    }
  }

  /**
   * Get user information from GitHub API
   */
  private async getUserInfo(token: string): Promise<any> {
    return await this.makeGitHubRequest('/user', token);
  }

  /**
   * Make a request to GitHub API
   */
  private makeGitHubRequest(path: string, token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path,
        headers: {
          'User-Agent': 'Graphify-CLI',
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        method: 'GET',
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error('Failed to parse GitHub API response'));
            }
          } else if (res.statusCode === 401) {
            reject(new Error('Invalid or expired GitHub token'));
          } else {
            reject(new Error(`GitHub API returned status code ${res.statusCode}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.end();
    });
  }

  /**
   * Get token scopes from GitHub API
   */
  private async getTokenScopes(token: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: '/user',
        headers: {
          'User-Agent': 'Graphify-CLI',
          'Authorization': `token ${token}`,
        },
        method: 'HEAD',
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          const scopesHeader = res.headers['x-oauth-scopes'] || '';
          const scopes = scopesHeader
            .split(',')
            .map(scope => scope.trim())
            .filter(Boolean);

          resolve(scopes);
        } else {
          reject(new Error(`GitHub API returned status code ${res.statusCode}`));
        }
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.end();
    });
  }

  /**
   * Validate if a token is still valid
   */
  private async validateToken(token: string): Promise<boolean> {
    try {
      const userInfo = await this.getUserInfo(token);
      return !!userInfo && !!userInfo.login;
    } catch (error) {
      return false;
    }
  }

  /**
   * Load authentication config from file
   */
  private async loadAuthConfig(): Promise<AuthConfig | null> {
    try {
      if (!existsSync(TOKEN_FILE)) {
        return null;
      }

      const configData = await fs.readFile(TOKEN_FILE, 'utf-8');
      return JSON.parse(configData);
    } catch (error) {
      // If there's an error reading the file, assume no auth
      return null;
    }
  }

  /**
   * Save authentication config to file
   */
  private async saveAuthConfig(config: AuthConfig): Promise<void> {
    try {
      // Create config directory if it doesn't exist
      if (!existsSync(CONFIG_DIR)) {
        await fs.mkdir(CONFIG_DIR, { recursive: true });
      }

      await fs.writeFile(TOKEN_FILE, JSON.stringify(config, null, 2), {
        mode: 0o600, // Read/write for owner only
      });
    } catch (error) {
      throw new Error(`Failed to save authentication: ${error.message}`);
    }
  }
}

/**
 * Check if the user is authenticated
 * This can be imported by other modules
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    // Check if token file exists
    if (!existsSync(TOKEN_FILE)) {
      return false;
    }

    const configData = await fs.readFile(TOKEN_FILE, 'utf-8');
    const config = JSON.parse(configData);

    return !!config && !!config.token;
  } catch (error) {
    return false;
  }
}

/**
 * Get the current auth token if available
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    if (!existsSync(TOKEN_FILE)) {
      return null;
    }

    const configData = await fs.readFile(TOKEN_FILE, 'utf-8');
    const config = JSON.parse(configData);

    return config?.token || null;
  } catch (error) {
    return null;
  }
}
