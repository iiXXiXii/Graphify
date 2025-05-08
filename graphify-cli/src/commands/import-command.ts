import { Command } from 'commander';
import * as path from 'path';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import { promises as fs } from 'fs';
import { validatePattern } from '../utils/pattern-utils.js';
import type { ContributionPattern } from '../utils/pattern-utils.js';

/**
 * Supported file formats for pattern import
 */
export type ImportFormat = 'json' | 'csv' | 'txt';

/**
 * Pattern metadata for storing and displaying information
 */
interface PatternMetadata {
  name: string;
  description: string;
  created: string;
  rows: number;
  columns: number;
  source?: string;
}

/**
 * Full pattern object with metadata and pattern data
 */
interface PatternObject {
  metadata: PatternMetadata;
  pattern: ContributionPattern;
}

/**
 * Setup the import command for the CLI
 *
 * @param program - Commander program instance
 */
export function setupImportCommand(program: Command): void {
  const importCommand = program
    .command('import')
    .description('Import patterns from various file formats');

  importCommand
    .requiredOption('-f, --file <file>', 'Path to the file to import')
    .option('-F, --format <format>', 'File format (json, csv, txt)', 'json')
    .option('-o, --output <file>', 'Output path to save the imported pattern')
    .option('--force', 'Ignore validation issues and force import', false)
    .action(async (options) => {
      try {
        // Validate file exists
        await validateFileExists(options.file);

        // Determine format from file extension if not specified
        const format = options.format || determineFormatFromFilename(options.file);

        console.log(chalk.blue(`Importing pattern from ${options.file} as ${format} format...`));

        // Import pattern based on format
        const pattern = await importPattern(options.file, format as ImportFormat, options.force);

        // Display pattern info
        showPatternInfo(pattern, options.file);

        // Save pattern if output path provided or ask user
        await handlePatternSaving(pattern, options.output, options.file);
      } catch (error: unknown) {
        console.error(chalk.red('Import error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

/**
 * Determine the file format from the filename extension
 *
 * @param filename - The filename to check
 * @returns The determined format
 */
function determineFormatFromFilename(filename: string): ImportFormat {
  const extension = path.extname(filename).toLowerCase();

  switch (extension) {
    case '.json':
      return 'json';
    case '.csv':
      return 'csv';
    case '.txt':
      return 'txt';
    default:
      return 'json'; // Default to JSON
  }
}

/**
 * Validate that a file exists and is accessible
 *
 * @param filePath - Path to check
 * @throws Error if file doesn't exist or isn't accessible
 */
async function validateFileExists(filePath: string): Promise<void> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Import a pattern from a file
 *
 * @param filePath - Path to the pattern file
 * @param format - Format of the file (json, csv, txt)
 * @param force - Whether to ignore validation issues
 * @returns The imported pattern
 * @throws Error if import fails
 */
async function importPattern(
  filePath: string,
  format: ImportFormat,
  force: boolean = false
): Promise<ContributionPattern> {
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');

    let pattern: ContributionPattern;

    switch (format.toLowerCase() as ImportFormat) {
      case 'json':
        pattern = await importFromJson(fileContent);
        break;
      case 'csv':
        pattern = await importFromCsv(fileContent);
        break;
      case 'txt':
        pattern = await importFromText(fileContent);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    // Validate the pattern
    const validationIssues = validatePattern(pattern);

    // Handle validation issues
    if (validationIssues.length > 0) {
      console.log(chalk.yellow('Pattern validation issues:'));
      validationIssues.forEach((issue: string) => console.log(chalk.yellow(`- ${issue}`)));

      // Critical issues require confirmation unless force is used
      const hasCriticalIssues = validationIssues.some((issue: string) =>
        issue.includes('Invalid') ||
        issue.includes('empty')
      );

      if (hasCriticalIssues && !force) {
        const { proceed } = await (inquirer as any).prompt({
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
  } catch (error: unknown) {
    // Preserve specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Import cancelled') ||
          error.message.includes('Unsupported format')) {
        throw error;
      }
      // Include the format in generic errors
      throw new Error(`Failed to import ${format} pattern: ${error.message}`);
    }
    throw new Error(`Failed to import ${format} pattern: Unknown error`);
  }
}

/**
 * Import pattern from JSON format
 *
 * @param content - JSON content string
 * @returns The parsed pattern
 * @throws Error if JSON parsing fails
 */
async function importFromJson(content: string): Promise<ContributionPattern> {
  try {
    const parsed = JSON.parse(content);

    // Handle different JSON structures
    let patternData: ContributionPattern = [];

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

        if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) {
          throw new Error('Cannot determine valid grid dimensions');
        }

        // Reshape 1D array to 2D
        patternData = [];
        for (let i = 0; i < rows; i++) {
          const row: number[] = [];
          for (let j = 0; j < cols; j++) {
            const index = i * cols + j;
            if (index >= parsed.grid.length) {
              row.push(0); // Pad with zeros if needed
            } else {
              const cell = parsed.grid[index];
              // Handle different cell formats
              if (typeof cell === 'object' && cell !== null) {
                row.push(
                  cell.value ?? cell.intensity ?? (cell.active ? 1 : 0)
                );
              } else {
                row.push(Number(cell) || 0);
              }
            }
          }
          // Apply normalizePatternValues to each row before pushing to ensure types match
          const typedRow = row.map(value =>
            Math.min(4, Math.max(0, Math.round(value))) as 0 | 1 | 2 | 3 | 4
          );
          patternData.push(typedRow);
        }
      }
    } else {
      throw new Error('Invalid pattern format: expected array or object with pattern/grid property');
    }

    // Normalize values to ensure they're between 0-4
    return normalizePatternValues(patternData);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes('Import cancelled')) {
        throw error;
      }
      throw new Error(`Invalid JSON: ${error.message}`);
    }
    throw new Error('Invalid JSON: Unknown error');
  }
}

/**
 * Import pattern from CSV format
 *
 * @param content - CSV content string
 * @returns The parsed pattern
 * @throws Error if CSV parsing fails
 */
async function importFromCsv(content: string): Promise<ContributionPattern> {
  try {
    // Parse CSV content
    const rows = content.trim().split(/\r?\n/);
    const pattern: number[][] = rows.map(row => {
      return row.split(',').map(cell => {
        const value = parseInt(cell.trim(), 10);
        // Handle non-numeric values gracefully
        if (isNaN(value)) {
          return 0;
        }
        return value;
      });
    });

    // Check for jagged array (rows with different lengths)
    const rowLengths = new Set(pattern.map(row => row.length));
    if (rowLengths.size > 1) {
      console.log(chalk.yellow('Warning: CSV has inconsistent row lengths. Rows will be padded with zeros.'));

      // Find the maximum row length
      const maxLength = Math.max(...pattern.map(row => row.length));

      // Pad shorter rows with zeros
      pattern.forEach(row => {
        while (row.length < maxLength) {
          row.push(0);
        }
      });
    }

    return normalizePatternValues(pattern);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Invalid CSV: ${error.message}`);
    }
    throw new Error('Invalid CSV: Unknown error');
  }
}

/**
 * Import pattern from text format (space/tab separated)
 *
 * @param content - Text content string
 * @returns The parsed pattern
 */
async function importFromText(content: string): Promise<ContributionPattern> {
  try {
    // Parse plain text (space/tab separated values)
    const rows = content.trim().split(/\r?\n/);
    const pattern: number[][] = rows.map(row => {
      // Split by whitespace (space or tab)
      return row.trim().split(/\s+/).map(cell => {
        const value = parseInt(cell.trim(), 10);
        if (isNaN(value)) {
          return 0;
        }
        return value;
      });
    });

    // Filter out empty rows
    const filteredPattern = pattern.filter(row => row.length > 0);

    if (filteredPattern.length === 0) {
      throw new Error('Pattern contains no valid data');
    }

    // Check for jagged array (rows with different lengths)
    const rowLengths = new Set(filteredPattern.map(row => row.length));
    if (rowLengths.size > 1) {
      console.log(chalk.yellow('Warning: Text pattern has inconsistent row lengths. Rows will be padded.'));

      // Find the maximum row length
      const maxLength = Math.max(...filteredPattern.map(row => row.length));

      // Pad shorter rows with zeros
      filteredPattern.forEach(row => {
        while (row.length < maxLength) {
          row.push(0);
        }
      });
    }

    return normalizePatternValues(filteredPattern);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Invalid text pattern: ${error.message}`);
    }
    throw new Error('Invalid text pattern: Unknown error');
  }
}

/**
 * Normalize pattern values to ensure they're between 0-4
 *
 * @param pattern - Raw pattern data
 * @returns Normalized pattern with values between 0-4
 */
function normalizePatternValues(pattern: number[][]): ContributionPattern {
  return pattern.map(row =>
    row.map(value => Math.min(4, Math.max(0, Math.round(value))) as 0 | 1 | 2 | 3 | 4)
  );
}

/**
 * Display information about the imported pattern
 *
 * @param pattern - The imported pattern
 * @param sourcePath - Original file path
 */
function showPatternInfo(pattern: ContributionPattern, _sourcePath: string): void {
  const rows = pattern.length;
  const cols = pattern[0]?.length || 0;

  console.log(chalk.green('✓ Pattern imported successfully'));
  console.log(`Dimensions: ${rows} rows × ${cols} columns`);
  console.log(`Total cells: ${rows * cols}`);

  // Count active cells (with values > 0)
  const activeCells = pattern.flat().filter((cell: number) => cell > 0).length;
  const activePercent = rows * cols > 0 ? Math.round(activeCells / (rows * cols) * 100) : 0;
  console.log(`Active cells: ${activeCells} (${activePercent}%)`);

  // Calculate intensity distribution
  const intensityCounts = countIntensities(pattern);
  console.log('Intensity distribution:');
  Object.entries(intensityCounts).forEach(([intensity, count]) => {
    if (count > 0) {
      const percent = Math.round((count / (rows * cols)) * 100);
      console.log(`  Level ${intensity}: ${count} cells (${percent}%)`);
    }
  });

  // Generate a simple ASCII preview
  console.log('\nPattern preview:');
  printPatternPreview(pattern);
}

/**
 * Count the occurrences of each intensity level in the pattern
 *
 * @param pattern - The pattern to analyze
 * @returns Map of intensity levels to counts
 */
function countIntensities(pattern: ContributionPattern): Record<number, number> {
  const counts: Record<number, number> = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0};

  pattern.forEach((row: number[]) => {
    row.forEach((cell: number) => {
      counts[cell] = (counts[cell] || 0) + 1;
    });
  });

  return counts;
}

/**
 * Print a visual preview of the pattern
 *
 * @param pattern - The pattern to preview
 */
function printPatternPreview(pattern: ContributionPattern): void {
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
  console.log('   ' + Array.from({ length: cols }, (_, i) => i % 10).join(''));

  // Print rows
  for (let i = 0; i < rows; i++) {
    let rowStr = `${i.toString().padStart(2)} `;

    for (let j = 0; j < cols; j++) {
      const val = pattern[i]?.[j] || 0;
      const colorFn = colors[Math.min(4, Math.max(0, val))];
      if (colorFn) {
        rowStr += colorFn(symbols[Math.min(4, Math.max(0, val))]);
      } else {
        rowStr += symbols[Math.min(4, Math.max(0, val))];
      }
    }

    console.log(rowStr);
  }

  // Indicate if pattern was truncated
  if (pattern.length > MAX_PREVIEW_SIZE || (pattern[0]?.length || 0) > MAX_PREVIEW_SIZE) {
    console.log(chalk.dim(`(Pattern preview truncated to ${MAX_PREVIEW_SIZE}×${MAX_PREVIEW_SIZE}, full size: ${pattern.length}×${pattern[0]?.length || 0})`));
  }
}

/**
 * Handle saving the imported pattern
 *
 * @param pattern - Pattern to save
 * @param outputPath - Path to save (or undefined to prompt)
 * @param sourcePath - Original source file path
 */
async function handlePatternSaving(
  pattern: ContributionPattern,
  outputPath?: string,
  sourcePath?: string
): Promise<void> {
  if (outputPath) {
    await savePattern(pattern, outputPath, sourcePath);
  } else {
    // Ask if user wants to save the pattern
    const { shouldSave } = await (inquirer as any).prompt({
      type: 'confirm',
      name: 'shouldSave',
      message: 'Would you like to save this pattern?',
      default: false,
    });

    if (shouldSave) {
      const { outputPath: userOutputPath } = await (inquirer as any).prompt({
        type: 'input',
        name: 'outputPath',
        message: 'Enter the path to save the pattern:',
        default: 'pattern.json',
      });

      await savePattern(pattern, userOutputPath, sourcePath);
    }
  }
}

/**
 * Save a pattern to a file
 *
 * @param pattern - Pattern to save
 * @param outputPath - Path to save to
 * @param sourcePath - Original source file (for metadata)
 */
async function savePattern(
  pattern: ContributionPattern,
  outputPath: string,
  sourcePath?: string
): Promise<void> {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Create pattern object with metadata
    const patternObject: PatternObject = {
      metadata: {
        name: 'Imported Pattern',
        description: 'Pattern imported by Graphify CLI',
        created: new Date().toISOString(),
        rows: pattern.length,
        columns: pattern[0]?.length || 0,
        source: sourcePath
      },
      pattern: pattern
    };

    // Write to file with pretty formatting
    await fs.writeFile(outputPath, JSON.stringify(patternObject, null, 2));

    console.log(chalk.green(`✓ Pattern saved to ${outputPath}`));
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Failed to save pattern: ${error.message}`);
    }
    throw new Error('Failed to save pattern: Unknown error');
  }
}

