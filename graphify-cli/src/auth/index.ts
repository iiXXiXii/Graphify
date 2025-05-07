import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import chalk from 'chalk';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import { ConfigService } from '../config/config.service';

// Path for storing auth configuration
const CONFIG_DIR = path.join(os.homedir(), '.graphify');
const TOKEN_FILE = path.join(CONFIG_DIR, 'auth.json');

// In-memory token storage - this won't persist across sessions
// Only used when encryption isn't possible
let inMemoryToken: string | null = null;

interface AuthData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string[];
  username?: string;
}

/**
 * Encrypt sensitive data
 */
function encrypt(text: string, encryptionKey: string): { iv: string, content: string } {
  try {
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
  } catch (error) {
    console.error('Encryption failed, falling back to in-memory storage');
    return { iv: '', content: '' };
  }
}

/**
 * Decrypt sensitive data
 */
function decrypt(encrypted: { iv: string, content: string }, encryptionKey: string): string {
  try {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(crypto.createHash('sha256').update(encryptionKey).digest('base64').substr(0, 32)),
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

/**
 * Save auth data securely to file
 */
async function saveAuthData(authData: AuthData, encryptionKey: string): Promise<boolean> {
  try {
    // Ensure config directory exists
    await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 }); // Set secure permissions

    // Encrypt the token data
    const encryptedData = encrypt(JSON.stringify(authData), encryptionKey);

    // If encryption failed, store in memory only
    if (!encryptedData.iv) {
      inMemoryToken = authData.accessToken;
      return false;
    }

    // Write to file
    await fs.writeFile(TOKEN_FILE, JSON.stringify(encryptedData), {
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

/**
 * Load auth data from secure storage
 */
async function loadAuthData(encryptionKey: string): Promise<AuthData | null> {
  try {
    try {
      await fs.access(TOKEN_FILE);
    } catch {
      return null;
    }

    const encryptedData = JSON.parse(await fs.readFile(TOKEN_FILE, 'utf8'));
    const decrypted = decrypt(encryptedData, encryptionKey);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to load auth data from disk');
    return null;
  }
}

/**
 * Check if token has expired
 */
function isTokenExpired(authData: AuthData): boolean {
  if (!authData.expiresAt) return false;

  // Add a 5-minute buffer to be safe
  return Date.now() > (authData.expiresAt - 5 * 60 * 1000);
}

/**
 * Get a valid auth token, refreshing if necessary
 */
export async function getAuthToken(): Promise<string> {
  const config = new ConfigService();
  const encryptionKey = config.get('GRAPHIFY_ENCRYPTION_KEY') || 'default-encryption-key';

  // Check in-memory token first
  if (inMemoryToken) {
    return inMemoryToken;
  }

  // Try to load from file
  const authData = await loadAuthData(encryptionKey);

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

/**
 * Authenticate with GitHub using device flow
 */
export async function authenticateWithGitHub(): Promise<void> {
  const config = new ConfigService();
  const clientId = config.get('GITHUB_CLIENT_ID');
  const encryptionKey = config.get('GRAPHIFY_ENCRYPTION_KEY') || 'default-encryption-key';

  // Check for required environment variables
  if (!clientId) {
    throw new Error('GitHub Client ID is not set. Please set GITHUB_CLIENT_ID environment variable.');
  }

  console.log('Starting GitHub authentication...');

  // Create OAuth device auth flow
  const auth = createOAuthDeviceAuth({
    clientType: 'oauth-app',
    clientId,
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
    const savedToFile = await saveAuthData(authData, encryptionKey);

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

/**
 * Get location where auth token is stored
 */
export function getStorageLocation(): string {
  if (inMemoryToken) {
    return 'in-memory (temporary)';
  }

  return TOKEN_FILE;
}

/**
 * Logout and remove authentication data
 */
export async function logout(): Promise<void> {
  try {
    // Clear in-memory token
    inMemoryToken = null;

    // Delete token file if it exists
    try {
      await fs.access(TOKEN_FILE);
      await fs.unlink(TOKEN_FILE);
    } catch {
      // File doesn't exist, nothing to do
    }

    console.log('Successfully logged out from GitHub.');
  } catch (error) {
    console.error('Error during logout:', error.message);
    throw new Error(`Logout failed: ${error.message}`);
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    await getAuthToken();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get GitHub user information
 */
export async function getUserInfo(): Promise<{ username: string } | null> {
  try {
    const config = new ConfigService();
    const encryptionKey = config.get('GRAPHIFY_ENCRYPTION_KEY') || 'default-encryption-key';

    const authData = await loadAuthData(encryptionKey);
    if (!authData) {
      return null;
    }

    // If we don't have username stored yet, we need to fetch it from GitHub
    if (!authData.username) {
      const token = await getAuthToken();
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Graphify-CLI'
        }
      });

      if (response.ok) {
        const data = await response.json();

        // Update stored auth data with username
        authData.username = data.login;
        await saveAuthData(authData, encryptionKey);

        return { username: data.login };
      }

      return null;
    }

    return { username: authData.username };
  } catch (error) {
    console.error('Error getting user info:', error.message);
    return null;
  }
}
