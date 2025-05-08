import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import chalk from 'chalk';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import type { OAuthDeviceAuthOptions, OAuthAppAuthentication } from '@octokit/auth-oauth-device';

// Path for storing auth configuration
const CONFIG_DIR = path.join(os.homedir(), '.graphify');
const TOKEN_FILE = path.join(CONFIG_DIR, 'auth.json');
const DEVICE_KEY_FILE = path.join(CONFIG_DIR, 'device.key');

interface AuthData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string[];
  username?: string;
}

// Define a custom interface that extends OAuthAppAuthentication with our additional properties
interface ExtendedOAuthAppAuthentication extends OAuthAppAuthentication {
  refreshToken?: string;
  expiresAt?: Date;
}

export class AuthService {
  private configService: any;

  constructor() {
    try {
      // Dynamic import to avoid circular dependencies
      const { ConfigService } = require('../config/config.service');
      this.configService = new ConfigService();
    } catch (error) {
      console.error('Failed to load ConfigService:', (error as Error).message);
      throw new Error('Configuration service unavailable. Please check your installation.');
    }
  }

  /**
   * Get a secure encryption key
   * This method now requires either an environment variable or
   * a device-specific key file - no insecure defaults
   */
  private async getEncryptionKey(): Promise<string> {
    // First check environment variable
    const envKey = this.configService.get('GRAPHIFY_ENCRYPTION_KEY');
    if (envKey) {
      return envKey;
    }

    // Then try to load from device-specific key file
    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });

      try {
        // Check if key file exists
        await fs.access(DEVICE_KEY_FILE);
        // If it exists, read and return it
        return await fs.readFile(DEVICE_KEY_FILE, { encoding: 'utf8' });
      } catch (err) {
        // If key file doesn't exist, generate a secure random key
        const newKey = crypto.randomBytes(32).toString('hex');
        // Save the key with secure permissions
        await fs.writeFile(DEVICE_KEY_FILE, newKey, { mode: 0o600 });
        console.log(chalk.green(`✓ Generated secure encryption key at ${DEVICE_KEY_FILE}`));
        return newKey;
      }
    } catch (err) {
      const error = err as Error;
      throw new Error(
        `Failed to secure authentication tokens: ${error.message}. Set GRAPHIFY_ENCRYPTION_KEY environment variable or ensure ~/.graphify directory is writable.`
      );
    }
  }

  /**
   * Encrypt sensitive data
   */
  private async encrypt(text: string): Promise<{ iv: string, content: string }> {
    try {
      const encryptionKey = await this.getEncryptionKey();

      // Create a unique initialization vector for each encryption
      const iv = crypto.randomBytes(16);
      // Create a cipher using our encryption key and IV
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(crypto.createHash('sha256').update(encryptionKey).digest('base64').substr(0, 32)),
        iv
      );

      // Encrypt the data
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        iv: iv.toString('hex'),
        content: encrypted
      };
    } catch (err) {
      const error = err as Error;
      console.error(chalk.red('Encryption failed:'), error.message);
      throw new Error(`Failed to secure authentication data: ${error.message}. Please check your configuration.`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  private async decrypt(encrypted: { iv: string, content: string }): Promise<string> {
    try {
      const encryptionKey = await this.getEncryptionKey();

      const iv = Buffer.from(encrypted.iv, 'hex');
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(crypto.createHash('sha256').update(encryptionKey).digest('base64').substr(0, 32)),
        iv
      );

      let decrypted = decipher.update(encrypted.content, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err) {
      const error = err as Error;
      throw new Error(`Failed to decrypt authentication token: ${error.message}. You may need to log in again.`);
    }
  }

  /**
   * Save auth data securely to file
   */
  public async saveAuthData(authData: AuthData): Promise<void> {
    try {
      // Ensure config directory exists with secure permissions
      await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });

      // Encrypt the token data
      const encryptedData = await this.encrypt(JSON.stringify(authData));

      // Write to file with secure permissions
      await fs.writeFile(TOKEN_FILE, JSON.stringify(encryptedData), {
        encoding: 'utf8',
        mode: 0o600 // Read/write for user only
      });
    } catch (err) {
      const error = err as Error;
      throw new Error(`Failed to save authentication data: ${error.message}`);
    }
  }

  /**
   * Load auth data from secure storage
   */
  public async loadAuthData(): Promise<AuthData | null> {
    try {
      try {
        await fs.access(TOKEN_FILE);
      } catch {
        return null;
      }

      const fileContent = await fs.readFile(TOKEN_FILE, 'utf8');
      const encryptedData = JSON.parse(fileContent);
      const decrypted = await this.decrypt(encryptedData);
      return JSON.parse(decrypted) as AuthData;
    } catch (err) {
      const error = err as Error;
      console.error(chalk.yellow('Failed to load auth data:'), error.message);
      return null;
    }
  }

  /**
   * Check if token has expired
   */
  private isTokenExpired(authData: AuthData): boolean {
    if (!authData.expiresAt) return false;

    // Add a 5-minute buffer to be safe
    return Date.now() > (authData.expiresAt - 5 * 60 * 1000);
  }

  /**
   * Get a valid auth token, refreshing if necessary
   */
  public async getAuthToken(): Promise<string> {
    // Try to load from file
    const authData = await this.loadAuthData();

    if (!authData) {
      throw new Error('Not authenticated. Please log in first using "graphify auth login".');
    }

    // Check if token has expired
    if (this.isTokenExpired(authData) && authData.refreshToken) {
      try {
        // Attempt to refresh the token
        const newAuth = await this.refreshToken(authData.refreshToken);
        return newAuth.accessToken;
      } catch (err) {
        const error = err as Error;
        // If refresh fails, force a new login
        throw new Error(`Authentication expired and refresh failed: ${error.message}. Please log in again using "graphify auth login".`);
      }
    } else if (this.isTokenExpired(authData)) {
      // No refresh token available
      throw new Error('Authentication expired. Please log in again using "graphify auth login".');
    }

    return authData.accessToken;
  }

  /**
   * Refresh an expired token
   */
  private async refreshToken(refreshToken: string): Promise<AuthData> {
    const clientId = this.configService.get('GITHUB_CLIENT_ID');
    const clientSecret = this.configService.get('GITHUB_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('Missing GitHub credentials for token refresh');
    }

    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      const responseData = await response.json();

      // Type check the response data
      if (!responseData || typeof responseData !== 'object') {
        throw new Error('Invalid response from GitHub');
      }

      const data = responseData as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        error?: string;
        error_description?: string;
      };

      if (data.error || !data.access_token) {
        throw new Error(data.error_description || 'Failed to refresh token');
      }

      // Create the new auth data object
      const authData: AuthData = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: data.expires_in ? Date.now() + (data.expires_in * 1000) : undefined,
        scope: data.scope ? data.scope.split(',') : undefined
      };

      // Save the new token
      await this.saveAuthData(authData);

      return authData;
    } catch (err) {
      const error = err as Error;
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Authenticate with GitHub using device flow
   */
  public async authenticateWithGitHub(): Promise<void> {
    const clientId = this.configService.get('GITHUB_CLIENT_ID');

    // Check for required environment variables
    if (!clientId) {
      throw new Error('GitHub Client ID is not set. Please set GITHUB_CLIENT_ID environment variable.');
    }

    console.log(chalk.blue('Starting GitHub authentication...'));

    // Create OAuth device auth flow
    const auth = createOAuthDeviceAuth({
      clientType: 'oauth-app',
      clientId,
      scopes: ['repo'], // Request minimal permissions needed
      onVerification: ({ verification_uri, user_code }) => {
        console.log('\nComplete your authentication in your browser:');
        console.log(`1. Open: ${chalk.blue(verification_uri)}`);
        console.log(`2. Enter code: ${chalk.green(user_code)}`);
        console.log('\nWaiting for authentication...');
      },
    });

    try {
      // Start auth flow - use our extended type
      const authResult = await auth({ type: 'oauth' }) as ExtendedOAuthAppAuthentication;

      // Create auth data object
      const authData: AuthData = {
        accessToken: authResult.token,
        refreshToken: authResult.refreshToken,
        scope: authResult.scopes,
        expiresAt: authResult.expiresAt?.getTime()
      };

      // Save token securely
      await this.saveAuthData(authData);

      // Get and save username
      await this.getUserInfo();

      console.log(chalk.green('\n✓ Authentication successful!'));
      console.log(`Token securely stored in ${TOKEN_FILE}`);

      return;
    } catch (err) {
      const error = err as Error;
      console.error(chalk.red('\nAuthentication failed:'), error.message);
      throw new Error(`GitHub authentication failed: ${error.message}`);
    }
  }

  /**
   * Get location where auth token is stored
   */
  public getStorageLocation(): string {
    return TOKEN_FILE;
  }

  /**
   * Logout and remove authentication data
   */
  public async logout(): Promise<void> {
    try {
      // Delete token file if it exists
      try {
        await fs.access(TOKEN_FILE);
        await fs.unlink(TOKEN_FILE);
      } catch (err) {
        // File doesn't exist, nothing to do
      }

      console.log(chalk.green('Successfully logged out from GitHub.'));
    } catch (err) {
      const error = err as Error;
      console.error('Error during logout:', error.message);
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Check if user is authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    try {
      const authData = await this.loadAuthData();
      return !!authData && !!authData.accessToken;
    } catch {
      return false;
    }
  }

  /**
   * Get GitHub user information
   */
  public async getUserInfo(): Promise<{ username: string } | null> {
    try {
      const token = await this.getAuthToken();

      // Call GitHub API to get user info
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Graphify-CLI'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      const userData = await response.json() as { login: string, name: string };

      if (userData && userData.login) {
        // Update stored auth data with username
        const authData = await this.loadAuthData();
        if (authData) {
          authData.username = userData.login;
          await this.saveAuthData(authData);
        }

        return { username: userData.login };
      }

      return null;
    } catch (err) {
      const error = err as Error;
      console.error(chalk.yellow('Failed to get user info:'), error.message);
      return null;
    }
  }
}
