import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

export class ConfigService {
  private readonly envConfig: { [key: string]: string };

  constructor() {
    this.envConfig = {};

    // Load from .env file if it exists
    const envFile = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envFile)) {
      const config = dotenv.parse(fs.readFileSync(envFile));
      this.envConfig = config;
    }

    // Override with environment variables
    for (const key in process.env) {
      if (process.env[key] !== undefined) {
        this.envConfig[key] = process.env[key] || '';
      }
    }
  }

  /**
   * Get a configuration value
   */
  get(key: string, defaultValue?: string): string {
    return this.envConfig[key] || defaultValue || '';
  }
}

// Add default export for dynamic import compatibility
export default ConfigService;
