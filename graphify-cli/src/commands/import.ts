import { Command, Flags } from '@oclif/core';
import { promises as fs } from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import { validatePattern } from '../utils/scheduler';

export default class Import extends Command {
  static description = 'Import patterns from various file formats';

  static examples = [
    '$ graphify import --file pattern.json',
    '$ graphify import --file pattern.csv --format csv',
    '$ graphify import --file pattern.json --output output.json',
  ];

  static flags = {
    file: Flags.string({
      char: 'f',
      description: 'Path to the file to import',
      required: true,
    }),
    format: Flags.string({
      char: 'F',
      description: 'File format (json, csv)',
      options: ['json', 'csv'],
      default: 'json',
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output path to save the imported pattern',
      required: false,
    }),
  };

  async run() {
    const { flags } = await this.parse(Import);

    try {
      // Validate file exists
      await this.validateFileExists(flags.file);

      // Import pattern based on format
      const pattern = await this.importPattern(flags.file, flags.format);

      // Display pattern info
      this.showPatternInfo(pattern);

      // Save pattern if output path provided
      if (flags.output) {
        await this.savePattern(pattern, flags.output);
      } else {
        // Ask if user wants to save the pattern
        const { shouldSave } = await inquirer.prompt({
          type: 'confirm',
          name: 'shouldSave',
          message: 'Would you like to save this pattern?',
          default: false,
        });

        if (shouldSave) {
          const { outputPath } = await inquirer.prompt({
            type: 'input',
            name: 'outputPath',
            message: 'Enter the path to save the pattern:',
            default: 'pattern.json',
          });

          await this.savePattern(pattern, outputPath);
        }
      }
    } catch (error) {
      this.error(chalk.red(`Import error: ${error.message}`));
    }
  }

  private async validateFileExists(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Not a file: ${filePath}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  private async importPattern(filePath: string, format: string): Promise<number[][]> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');

      switch (format.toLowerCase()) {
        case 'json':
          return await this.importFromJson(fileContent);
        case 'csv':
          return await this.importFromCsv(fileContent);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      if (error.message.includes('Unsupported format')) {
        throw error;
      }
      throw new Error(`Failed to import pattern: ${error.message}`);
    }
  }

  private async importFromJson(content: string): Promise<number[][]> {
    try {
      const parsed = JSON.parse(content);

      // Handle different JSON structures
      let patternData: number[][] = [];

      if (Array.isArray(parsed)) {
        if (Array.isArray(parsed[0])) {
          // Direct 2D array
          patternData = parsed;
        } else {
          // 1D array, convert to 2D with one row
          patternData = [parsed];
        }
      } else if (parsed.pattern && Array.isArray(parsed.pattern)) {
        if (Array.isArray(parsed.pattern[0])) {
          // Object with 2D pattern array
          patternData = parsed.pattern;
        } else {
          // Object with 1D pattern array, convert to 2D
          patternData = [parsed.pattern];
        }
      } else if (parsed.grid && Array.isArray(parsed.grid)) {
        // Handle grid property
        if (Array.isArray(parsed.grid[0])) {
          patternData = parsed.grid;
        } else {
          // 1D grid array, try to convert to 2D
          const cols = parsed.columns || Math.sqrt(parsed.grid.length);
          const rows = parsed.rows || parsed.grid.length / cols;

          if (!Number.isInteger(cols) || !Number.isInteger(rows)) {
            throw new Error('Cannot determine grid dimensions');
          }

          // Reshape 1D array to 2D
          patternData = [];
          for (let i = 0; i < rows; i++) {
            const row: number[] = [];
            for (let j = 0; j < cols; j++) {
              const index = i * cols + j;
              const cell = parsed.grid[index];
              row.push(typeof cell === 'object' && cell !== null ? (cell.intensity || (cell.active ? 1 : 0)) : cell);
            }
            patternData.push(row);
          }
        }
      } else {
        throw new Error('Invalid pattern format: expected array or object with pattern/grid property');
      }

      // Validate the pattern
      const validationIssues = validatePattern(patternData);
      if (validationIssues.length > 0) {
        this.log(chalk.yellow('Pattern validation issues:'));
        validationIssues.forEach(issue => this.log(chalk.yellow(`- ${issue}`)));

        // If there are critical issues, confirm before proceeding
        if (validationIssues.some(issue => issue.includes('Invalid'))) {
          const { proceed } = await inquirer.prompt({
            type: 'confirm',
            name: 'proceed',
            message: 'Pattern has validation issues. Continue anyway?',
            default: false,
          });

          if (!proceed) {
            throw new Error('Import cancelled due to validation issues');
          }
        }
      }

      return patternData;
    } catch (error) {
      if (error.message.includes('Import cancelled')) {
        throw error;
      }
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }

  private async importFromCsv(content: string): Promise<number[][]> {
    try {
      // Parse CSV content
      const rows = content.trim().split(/\r?\n/);
      const pattern: number[][] = rows.map(row => {
        return row.split(',').map(cell => {
          const value = parseInt(cell.trim(), 10);
          if (isNaN(value)) {
            return 0;
          }
          return Math.min(4, Math.max(0, value)); // Clamp between 0-4
        });
      });

      // Check for jagged array (rows with different lengths)
      const rowLengths = new Set(pattern.map(row => row.length));
      if (rowLengths.size > 1) {
        this.log(chalk.yellow('Warning: CSV has inconsistent row lengths. Rows will be padded with zeros.'));

        // Find the maximum row length
        const maxLength = Math.max(...pattern.map(row => row.length));

        // Pad shorter rows with zeros
        pattern.forEach(row => {
          while (row.length < maxLength) {
            row.push(0);
          }
        });
      }

      // Validate the pattern
      const validationIssues = validatePattern(pattern);
      if (validationIssues.length > 0) {
        this.log(chalk.yellow('Pattern validation issues:'));
        validationIssues.forEach(issue => this.log(chalk.yellow(`- ${issue}`)));

        if (validationIssues.some(issue => issue.includes('Invalid'))) {
          const { proceed } = await inquirer.prompt({
            type: 'confirm',
            name: 'proceed',
            message: 'Pattern has validation issues. Continue anyway?',
            default: false,
          });

          if (!proceed) {
            throw new Error('Import cancelled due to validation issues');
          }
        }
      }

      return pattern;
    } catch (error) {
      if (error.message.includes('Import cancelled')) {
        throw error;
      }
      throw new Error(`Invalid CSV: ${error.message}`);
    }
  }

  private showPatternInfo(pattern: number[][]): void {
    const rows = pattern.length;
    const cols = pattern[0]?.length || 0;

    this.log(chalk.green('✓ Pattern imported successfully'));
    this.log(`Dimensions: ${rows} rows × ${cols} columns`);
    this.log(`Total cells: ${rows * cols}`);

    // Count active cells (with values > 0)
    const activeCells = pattern.flat().filter(cell => cell > 0).length;
    this.log(`Active cells: ${activeCells} (${Math.round(activeCells / (rows * cols) * 100)}%)`);

    // Generate a simple ASCII preview
    this.log('\nPattern preview:');
    this.printPatternPreview(pattern);
  }

  private printPatternPreview(pattern: number[][]): void {
    const MAX_PREVIEW_SIZE = 20; // Maximum dimensions for preview

    const rows = Math.min(pattern.length, MAX_PREVIEW_SIZE);
    const cols = Math.min(pattern[0]?.length || 0, MAX_PREVIEW_SIZE);

    const symbols = [' ', '▪', '▪', '▪', '▪']; // Different symbols for each intensity level
    const colors = [
      chalk.dim,      // 0 - empty
      chalk.green,    // 1 - light
      chalk.green,    // 2 - medium
      chalk.green,    // 3 - heavy
      chalk.bgGreen   // 4 - maximum
    ];

    // Print column header (numbers)
    this.log('   ' + Array.from({ length: cols }, (_, i) => i % 10).join(''));

    // Print rows
    for (let i = 0; i < rows; i++) {
      let rowStr = `${i.toString().padStart(2)} `;

      for (let j = 0; j < cols; j++) {
        const val = pattern[i][j] || 0;
        const colorFn = colors[Math.min(4, Math.max(0, val))];
        rowStr += colorFn(symbols[Math.min(4, Math.max(0, val))]);
      }

      this.log(rowStr);
    }

    // Indicate if pattern was truncated
    if (pattern.length > MAX_PREVIEW_SIZE || pattern[0]?.length > MAX_PREVIEW_SIZE) {
      this.log(chalk.dim('(Pattern preview truncated due to size)'));
    }
  }

  private async savePattern(pattern: number[][], outputPath: string): Promise<void> {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });

      // Create pattern object with metadata
      const patternObject = {
        metadata: {
          name: 'Imported Pattern',
          description: 'Pattern imported by Graphify CLI',
          created: new Date().toISOString(),
          rows: pattern.length,
          columns: pattern[0]?.length || 0
        },
        pattern: pattern
      };

      // Write to file with pretty formatting
      await fs.writeFile(outputPath, JSON.stringify(patternObject, null, 2));

      this.log(chalk.green(`✓ Pattern saved to ${outputPath}`));
    } catch (error) {
      throw new Error(`Failed to save pattern: ${error.message}`);
    }
  }
}
