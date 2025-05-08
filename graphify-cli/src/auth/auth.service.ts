import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import chalk from 'chalk';
import open from 'open';
import { randomBytes } from 'crypto';
import { createServer } from 'http';
import type { ConfigService } from '../config/config.service.js';

// Path for storing auth configuration
const CONFIG_DIR = path.join(os.homedir(), '.graphify');
const TOKEN_FILE = path.join(CONFIG_DIR, 'auth.json');
const DEVICE_KEY_FILE = path.join(CONFIG_DIR, 'device.key');

// Default API endpoints
const DEFAULT_API_URL = 'https://graphify-api.vercel.app'; // Our hosted API endpoint

export interface AuthData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string[];
  username?: string;
}

export class AuthService {
  private configService: ConfigService | null = null;
  private apiUrl: string = DEFAULT_API_URL;

  constructor() {
    this.initConfigService();
  }

  private async initConfigService(): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies using ES modules
      const { default: ConfigServiceClass } = await import('../config/config.service.js');
      this.configService = new ConfigServiceClass();

      // Check for custom API URL
      const customApiUrl = this.configService.get('GRAPHIFY_API_URL');
      if (customApiUrl) {
        this.apiUrl = customApiUrl;
      }
    } catch (error) {
      console.error('Failed to load ConfigService:', (error as Error).message);
      // Continue with defaults rather than throwing
    }
  }

  /**
   * Get a secure encryption key
   */
  private async getEncryptionKey(): Promise<string> {
    // Ensure config directory exists
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
      return newKey;
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
      throw new Error(`Failed to secure authentication data: ${error.message}`);
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
      throw new Error('Not authenticated. Please log in first using "graphify auth".');
    }

    // Check if token has expired
    if (this.isTokenExpired(authData) && authData.refreshToken) {
      try {
        // Attempt to refresh the token
        const newAuth = await this.refreshToken(authData.refreshToken);
        return newAuth.accessToken;
      } catch (err) {
        // If refresh fails, force a new login
        throw new Error(`Authentication expired. Please log in again using "graphify auth".`);
      }
    } else if (this.isTokenExpired(authData)) {
      // No refresh token available
      throw new Error('Authentication expired. Please log in again using "graphify auth".');
    }

    return authData.accessToken;
  }

  /**
   * Refresh an expired token
   */
  private async refreshToken(refreshToken: string): Promise<AuthData> {
    try {
      const response = await fetch(`${this.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      });

      const responseData = await response.json();

      if (!response.ok || !responseData.access_token) {
        throw new Error('Failed to refresh token');
      }

      // Create the new auth data object
      const authData: AuthData = {
        accessToken: responseData.access_token,
        refreshToken: responseData.refresh_token || refreshToken,
        expiresAt: responseData.expires_in ? Date.now() + (responseData.expires_in * 1000) : undefined,
        scope: responseData.scope ? responseData.scope.split(',') : undefined
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
   * Create a local server to receive the OAuth callback
   */
  private createLocalServer(state: string): Promise<{ server: any, authCode: Promise<string> }> {
    return new Promise((resolve) => {
      // Create a promise that will be resolved when we get the auth code
      let resolveAuthCode: (code: string) => void;
      const authCode = new Promise<string>(resolve => {
        resolveAuthCode = resolve;
      });

      // Create a temporary local server to receive the OAuth callback
      const server = createServer(async (req, res) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');

        // Handle the callback
        if (code && returnedState === state) {
          // Send success page to browser
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 2em; text-align: center;">
                <h1>Authentication Successful!</h1>
                <p>You have successfully authenticated with GitHub.</p>
                <p>You can close this window and return to the CLI.</p>
                <script>window.close();</script>
              </body>
            </html>
          `);

          // Resolve the promise with the auth code
          resolveAuthCode(code);

          // Close the server after a short delay
          setTimeout(() => server.close(), 1000);
        } else {
          // Handle error
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: sans-serif; padding: 2em; text-align: center;">
                <h1>Authentication Failed</h1>
                <p>Invalid authentication response.</p>
                <p>Please close this window and try again.</p>
              </body>
            </html>
          `);
        }
      }).listen(0); // Use 0 to let the OS assign an available port

      // Once the server is listening, resolve the promise
      server.on('listening', () => {
        const address = server.address();
        const port = address.port;
        resolve({ server, authCode });
      });
    });
  }

  /**
   * Authenticate with GitHub using browser flow
   */
  public async authenticateWithGitHub(): Promise<void> {
    console.log(chalk.blue('Starting GitHub authentication...'));

    try {
      // Generate a random state value for security
      const state = randomBytes(16).toString('hex');

      // Create a local server to receive the OAuth callback
      const { server, authCode } = await this.createLocalServer(state);
      const callbackPort = server.address().port;

      // Get the authorization URL from the hosted service or local config
      const authUrl = `${this.apiUrl}/auth/github/authorize?callback_port=${callbackPort}&state=${state}`;

      console.log(chalk.blue('Opening browser for authentication...'));

      // Open the browser to the authorization URL
      await open(authUrl);

      console.log(chalk.yellow('Waiting for authentication in your browser...'));

      // Wait for the user to authenticate and get the auth code
      const code = await authCode;

      // Exchange the code for an access token
      const tokenResponse = await fetch(`${this.apiUrl}/auth/github/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
          callback_port: callbackPort
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.access_token) {
        throw new Error('Failed to get access token');
      }

      // Create auth data object
      const authData: AuthData = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : undefined,
        scope: tokenData.scope ? tokenData.scope.split(',') : undefined
      };

      // Save token securely
      await this.saveAuthData(authData);

      // Get and save username
      await this.getUserInfo();

      console.log(chalk.green('\n✓ Authentication successful!'));
      console.log(`Token securely stored in ${TOKEN_FILE}`);

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
          'Authorization': `Bearer ${token}`,
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
