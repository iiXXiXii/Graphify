import jsonfile from 'jsonfile';
import fs from 'fs';
import path from 'path';

/**
 * File management utilities for Graphify
 */
export class FileManager {
  /**
   * Writes data to a JSON file
   * @param filePath Path to the file
   * @param data Data to write
   * @returns Promise resolving when the file is written
   */
  static async writeJsonFile(filePath: string, data: Record<string, any>): Promise<void> {
    try {
      // Make sure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      return new Promise((resolve, reject) => {
        jsonfile.writeFile(filePath, data, { spaces: 2 }, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Reads data from a JSON file
   * @param filePath Path to the file
   * @returns Promise resolving with the file contents
   */
  static async readJsonFile<T = Record<string, any>>(filePath: string): Promise<T> {
    try {
      return new Promise((resolve, reject) => {
        jsonfile.readFile(filePath, (err, data) => {
          if (err) {
            if (err.code === 'ENOENT') {
              // File doesn't exist, return empty object
              resolve({} as T);
            } else {
              reject(err);
            }
          } else {
            resolve(data as T);
          }
        });
      });
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Checks if a file exists
   * @param filePath Path to the file
   * @returns True if the file exists
   */
  static fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
} 