import jsonfile from 'jsonfile';
import fs from 'fs';
import path from 'path';
import { ErrorHandler, ErrorCategory, GraphifyError } from './errorHandler.js';

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
            reject(new GraphifyError(
              `Error writing to file ${filePath}: ${err.message}`,
              ErrorCategory.FILE_SYSTEM,
              err
            ));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      ErrorHandler.getInstance().handle(error);
      throw new GraphifyError(
        `Failed to write JSON to ${filePath}`,
        ErrorCategory.FILE_SYSTEM,
        error instanceof Error ? error : undefined
      );
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
              reject(new GraphifyError(
                `Error reading file ${filePath}: ${err.message}`,
                ErrorCategory.FILE_SYSTEM,
                err
              ));
            }
          } else {
            resolve(data as T);
          }
        });
      });
    } catch (error) {
      ErrorHandler.getInstance().handle(error);
      throw new GraphifyError(
        `Failed to read JSON from ${filePath}`,
        ErrorCategory.FILE_SYSTEM,
        error instanceof Error ? error : undefined
      );
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

  /**
   * Creates a directory if it doesn't exist
   * @param dirPath Path to the directory
   * @returns True if the directory was created or already exists
   */
  static ensureDirectoryExists(dirPath: string): boolean {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return true;
    } catch (error) {
      ErrorHandler.getInstance().handle(error);
      return false;
    }
  }

  /**
   * Removes a file if it exists
   * @param filePath Path to the file
   * @returns True if the file was removed or didn't exist
   */
  static removeFile(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (error) {
      ErrorHandler.getInstance().handle(error);
      return false;
    }
  }
}

export default FileManager;
