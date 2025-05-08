import { Command } from 'commander';
import chalk from 'chalk';
// Fix inquirer import to handle type compatibility issues
import inquirer from 'inquirer';
import { promises as fs } from 'fs';
import * as path from 'path';
// Update import paths to use the alias
import { validatePattern } from '@shared/utils/pattern-utils.js';

// Define a type for inquirer prompt answers to help with type checking
interface PromptAnswer<T> {
  [key: string]: T;
}

export function setupPatternCommand(program: Command): void {
  const patternCommand = program
    .command('pattern')
    .description('Create and manage GitHub contribution patterns');

  patternCommand
    .command('create')
    .description('Create a new pattern')
    .option('-o, --output <file>', 'Output file path')
    .action(async (options) => {
      try {
        console.log(chalk.blue('Creating a new pattern...'));
        const pattern = await promptForPattern();

        // Display pattern preview
        console.log('\nPattern preview:');
        printPatternPreview(pattern);

        // Save pattern if output is specified or user wants to save
        let outputFile = options.output;
        if (!outputFile) {
          const { savePattern } = await inquirer.prompt({
            type: 'confirm',
            name: 'savePattern',
            message: 'Would you like to save this pattern?',
            default: true
          });

          if (savePattern) {
            const { filepath } = await inquirer.prompt({
              type: 'input',
              name: 'filepath',
              message: 'Enter the path to save the pattern:',
              default: 'pattern.json',
              validate: (input: string) => input ? true : 'Please provide a file path'
            });
            outputFile = filepath;
          }
        }

        if (outputFile) {
          await exportPattern(pattern, outputFile);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('Error creating pattern:'), errorMessage);
        process.exit(1);
      }
    });

  patternCommand
    .command('import')
    .description('Import a pattern from a file')
    .requiredOption('-f, --file <file>', 'Path to pattern file')
    .action(async (options) => {
      try {
        const pattern = await importPattern(options.file);
        console.log('\nPattern details:');
        printPatternPreview(pattern);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('Error importing pattern:'), errorMessage);
        process.exit(1);
      }
    });

  patternCommand
    .command('export')
    .description('Export a pattern to a file')
    .argument('<file>', 'Output file path')
    .action(async (file) => {
      try {
        const pattern = await promptForPattern();
        await exportPattern(pattern, file);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('Error exporting pattern:'), errorMessage);
        process.exit(1);
      }
    });

  patternCommand
    .command('view')
    .description('View a pattern from a file')
    .requiredOption('-f, --file <file>', 'Path to pattern file')
    .action(async (options) => {
      try {
        const pattern = await importPattern(options.file);
        console.log('\nPattern details:');
        printPatternPreview(pattern);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('Error viewing pattern:'), errorMessage);
        process.exit(1);
      }
    });
}

async function promptForPattern(): Promise<number[][]> {
  interface PatternTypePromptResponse {
    patternType: 'simple' | 'custom' | 'predefined';
  }

  const response = await inquirer.prompt<PatternTypePromptResponse>({
    type: 'list',
    name: 'patternType',
    message: 'Choose a pattern type:',
    choices: [
      { name: 'Simple (one intensity level)', value: 'simple' },
      { name: 'Custom grid (multiple intensity levels)', value: 'custom' },
      { name: 'Predefined shape', value: 'predefined' }
    ]
  });

  const { patternType } = response;

  if (patternType === 'simple') {
    interface SimplePatternResponse {
      rows: number;
      columns: number;
      intensity: number;
    }

    const responses = await inquirer.prompt<SimplePatternResponse>([
      {
        type: 'number',
        name: 'rows',
        message: 'Number of rows:',
        default: 5,
        validate: (input: number | undefined) =>
          input !== undefined && input > 0 && input <= 20 ? true : 'Please enter a number between 1 and 20'
      },
      {
        type: 'number',
        name: 'columns',
        message: 'Number of columns:',
        default: 7,
        validate: (input: number | undefined) =>
          input !== undefined && input > 0 && input <= 30 ? true : 'Please enter a number between 1 and 30'
      },
      {
        type: 'list',
        name: 'intensity',
        message: 'Choose intensity level:',
        choices: [
          { name: '1 - Light', value: 1 },
          { name: '2 - Medium', value: 2 },
          { name: '3 - Heavy', value: 3 },
          { name: '4 - Maximum', value: 4 }
        ],
        default: 1
      }
    ]);

    const { rows, columns, intensity } = responses;

    // Create a pattern with uniform intensity
    return Array(rows).fill(0).map(() => Array(columns).fill(intensity));
  } else if (patternType === 'predefined') {
    interface PredefinedShapeResponse {
      shape: string;
      width: number;
      height: number;
      intensity: number;
    }

    const responses = await inquirer.prompt<PredefinedShapeResponse>([
      {
        type: 'list',
        name: 'shape',
        message: 'Choose a predefined shape:',
        choices: [
          { name: 'Rectangle', value: 'rectangle' },
          { name: 'Heart', value: 'heart' },
          { name: 'Letter', value: 'letter' },
          { name: 'Sine Wave', value: 'sine' },
          { name: 'Random', value: 'random' }
        ]
      },
      {
        type: 'number',
        name: 'width',
        message: 'Width:',
        default: 7,
        validate: (input: number | undefined) =>
          input !== undefined && input > 0 && input <= 30 ? true : 'Please enter a number between 1 and 30'
      },
      {
        type: 'number',
        name: 'height',
        message: 'Height:',
        default: 7,
        validate: (input: number | undefined) =>
          input !== undefined && input > 0 && input <= 20 ? true : 'Please enter a number between 1 and 20'
      },
      {
        type: 'list',
        name: 'intensity',
        message: 'Choose intensity level:',
        choices: [
          { name: '1 - Light', value: 1 },
          { name: '2 - Medium', value: 2 },
          { name: '3 - Heavy', value: 3 },
          { name: '4 - Maximum', value: 4 }
        ],
        default: 2
      }
    ]);

    const { shape, width, height, intensity } = responses;

    // Get additional options based on shape
    let additionalOptions = {};
    if (shape === 'letter') {
      const { letter } = await inquirer.prompt({
        type: 'input',
        name: 'letter',
        message: 'Enter a letter:',
        default: 'G',
        validate: (input: string) =>
          input.length === 1 ? true : 'Please enter exactly one letter'
      });
      additionalOptions = { letter };
    }

    // Create a pattern using the predefined shape
    return createSimplePattern(shape, {
      width,
      height,
      intensity,
      ...additionalOptions
    });
  } else {
    console.log(chalk.blue('Creating a custom grid pattern:'));
    console.log(chalk.dim('Use 0-4 for intensity levels (0 = no commits, 4 = maximum intensity)'));

    interface CustomGridResponse {
      rows: number;
      columns: number;
      inputMethod: 'cell' | 'uniform' | 'random' | 'ascii';
    }

    const responses = await inquirer.prompt<CustomGridResponse>([
      {
        type: 'number',
        name: 'rows',
        message: 'Number of rows:',
        default: 5,
        validate: (input: number | undefined) =>
          input !== undefined && input > 0 && input <= 10 ? true : 'Please enter a number between 1 and 10'
      },
      {
        type: 'number',
        name: 'columns',
        message: 'Number of columns:',
        default: 7,
        validate: (input: number | undefined) =>
          input !== undefined && input > 0 && input <= 20 ? true : 'Please enter a number between 1 and 20'
      },
      {
        type: 'list',
        name: 'inputMethod',
        message: 'How would you like to input the pattern?',
        choices: [
          { name: 'Cell-by-cell (for small patterns)', value: 'cell' },
          { name: 'Uniform fill (all cells same value)', value: 'uniform' },
          { name: 'Random fill', value: 'random' },
          { name: 'ASCII art (text-based input)', value: 'ascii' }
        ],
        default: (answers: any) => {
          const rows = answers.rows || 5;
          const columns = answers.columns || 7;
          return rows * columns <= 25 ? 'cell' : 'uniform';
        }
      }
    ]);

    const { rows, columns, inputMethod } = responses;

    // Create an empty pattern
    const pattern: number[][] = Array(rows).fill(0).map(() => Array(columns).fill(0));

    switch (inputMethod) {
      case 'cell':
        // Prompt for each cell
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < columns; j++) {
            const { value } = await inquirer.prompt({
              type: 'list',
              name: 'value',
              message: `Intensity for cell [${i},${j}]:`,
              choices: [
                { name: '0 - No commits', value: 0 },
                { name: '1 - Light', value: 1 },
                { name: '2 - Medium', value: 2 },
                { name: '3 - Heavy', value: 3 },
                { name: '4 - Maximum', value: 4 }
              ]
            });
            if (pattern[i]) {
              pattern[i][j] = value;
            }
          }
        }
        break;

      case 'uniform':
        const { value } = await inquirer.prompt({
          type: 'list',
          name: 'value',
          message: 'Choose intensity level:',
          choices: [
            { name: '0 - No commits', value: 0 },
            { name: '1 - Light', value: 1 },
            { name: '2 - Medium', value: 2 },
            { name: '3 - Heavy', value: 3 },
            { name: '4 - Maximum', value: 4 }
          ]
        });

        for (let i = 0; i < rows; i++) {
          if (pattern[i]) {
            for (let j = 0; j < columns; j++) {
              pattern[i][j] = value;
            }
          }
        }
        break;

      case 'random':
        // Fill with random values
        for (let i = 0; i < rows; i++) {
          if (pattern[i]) {
            for (let j = 0; j < columns; j++) {
              pattern[i][j] = Math.floor(Math.random() * 5); // Random 0-4
            }
          }
        }
        break;

      case 'ascii':
        // ASCII art mode
        console.log(chalk.blue('ASCII Art Pattern Input'));
        console.log(chalk.dim('Use 0-4 for intensity levels. Enter one row per line. Use spaces between numbers.'));
        console.log(chalk.dim('Example for a 3x3 pattern: "1 2 3" (press Enter) "0 1 2" (press Enter) "3 4 1"'));

        for (let i = 0; i < rows; i++) {
          const { rowInput } = await inquirer.prompt({
            type: 'input',
            name: 'rowInput',
            message: `Enter values for row ${i + 1} (${columns} numbers):`,
            validate: (input: string) => {
              const values = input.trim().split(/\s+/).map(Number);
              if (values.length !== columns) {
                return `Please enter exactly ${columns} numbers`;
              }
              if (values.some(v => isNaN(v) || v < 0 || v > 4 || !Number.isInteger(v))) {
                return 'Please enter only integers from 0-4';
              }

              return true;
            }
          });

          const values = rowInput.trim().split(/\s+/).map(Number);
          if (pattern[i]) {
            pattern[i] = values;
          }
        }
        break;
    }

    return pattern;
  }
}

// Fix the type error for shape parameter
async function importPattern(file: string): Promise<number[][]> {
  try {
    // Ensure file exists
    try {
      await fs.access(file);
    } catch {
      throw new Error(`File not found: ${file}`);
    }

    // Read and parse the file
    const fileContent = await fs.readFile(file, 'utf-8');
    let pattern;

    try {
      pattern = JSON.parse(fileContent);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown JSON parse error';
      throw new Error(`Invalid JSON format: ${errorMessage}`);
    }

    // Handle different pattern formats
    let patternGrid: number[][] = [];

    if (Array.isArray(pattern)) {
      // Direct 2D array format
      if (Array.isArray(pattern[0])) {
        patternGrid = pattern;
      }
      // 1D array format (convert to 2D)
      else {
        patternGrid = [pattern];
      }
    }
    // Object with pattern property
    else if (pattern && pattern.pattern) {
      if (Array.isArray(pattern.pattern)) {
        patternGrid = Array.isArray(pattern.pattern[0])
          ? pattern.pattern
          : [pattern.pattern];
      } else {
        throw new Error('Invalid pattern format: "pattern" property is not an array');
      }
    }
    // Object with grid property
    else if (pattern && pattern.grid) {
      if (Array.isArray(pattern.grid)) {
        patternGrid = Array.isArray(pattern.grid[0])
          ? pattern.grid
          : [pattern.grid];
      } else {
        throw new Error('Invalid pattern format: "grid" property is not an array');
      }
    } else {
      throw new Error('Invalid pattern format: Expected an array or object with pattern/grid property');
    }

    // Validate the pattern
    const validationIssues = validatePattern(patternGrid);

    if (validationIssues.length > 0) {
      console.log(chalk.yellow('⚠ Pattern validation issues:'));
      validationIssues.forEach((issue: string) => console.log(chalk.dim(`  - ${issue}`)));

      if (process.stdout.isTTY) {
        const { continueAnyway } = await inquirer.prompt({
          type: 'confirm',
          name: 'continueAnyway',
          message: 'Use this pattern anyway?',
          default: !validationIssues.some((i: string) => i.includes('Invalid'))
        });

        if (!continueAnyway) {
          throw new Error('Pattern import aborted due to validation issues');
        }
      } else if (validationIssues.some((i: string) => i.includes('Invalid'))) {
        throw new Error('Pattern has validation errors and cannot be imported in non-interactive mode');
      }
    }

    console.log(chalk.green('✓ Pattern imported successfully'));
    console.log(`Dimensions: ${patternGrid.length} rows × ${patternGrid[0]?.length || 0} columns`);
    console.log(`Total cells: ${patternGrid.length * (patternGrid[0]?.length || 0)}`);

    return patternGrid;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(chalk.red('Error importing pattern:'), errorMessage);
    throw error;
  }
}

// Fix createSimplePattern to define shape type
function createSimplePattern(shape: string, options: {
  width: number;
  height: number;
  intensity: number;
  letter?: string;
}): number[][] {
  const { width, height, intensity, letter } = options;
  const pattern: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));

  // Fill pattern based on shape
  switch (shape) {
    case 'rectangle':
      // Fill entire rectangle
      for (let i = 0; i < height; i++) {
        if (pattern[i]) {
          for (let j = 0; j < width; j++) {
            pattern[i][j] = intensity;
          }
        }
      }
      break;

    // Handle other shapes...
    default:
      // Default to a simple square in the middle
      const midRow = Math.floor(height / 2);
      const midCol = Math.floor(width / 2);
      const size = Math.min(3, Math.min(height, width));

      for (let i = midRow - Math.floor(size/2); i <= midRow + Math.floor(size/2); i++) {
        if (pattern[i]) {
          for (let j = midCol - Math.floor(size/2); j <= midCol + Math.floor(size/2); j++) {
            if (j >= 0 && j < width) {
              pattern[i][j] = intensity;
            }
          }
        }
      }
      break;
  }

  return pattern;
}

// Fix the remaining null checks in pattern-command.ts for printPatternPreview
function printPatternPreview(pattern: number[][]) {
  const colorMap = [
    chalk.dim('□'),        // 0: No commits
    chalk.green('▫'),      // 1: Light
    chalk.green('▪'),      // 2: Medium
    chalk.green.bold('■'), // 3: Heavy
    chalk.bgGreen('■')     // 4: Maximum
  ];

  const rows = pattern.length;
  const cols = pattern[0]?.length || 0;

  // Print column numbers
  console.log('   ' + Array.from({ length: cols }, (_, i) => (i % 5 === 0 ? Math.floor(i/5).toString() : ' ')).join(''));
  console.log('   ' + Array.from({ length: cols }, (_, i) => i % 5).join(''));

  // Print pattern
  for (let i = 0; i < rows; i++) {
    let rowStr = `${i.toString().padStart(2)} `;
    if (pattern[i]) {
      rowStr += pattern[i].map(cell => colorMap[cell] || colorMap[0]).join(' ');
    }
    console.log(rowStr);
  }
}

async function exportPattern(pattern: number[][], file: string): Promise<void> {
  try {
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(file), { recursive: true });

    // Wrap in an object with metadata
    const patternObject = {
      pattern,
      metadata: {
        name: 'Custom Pattern',
        created: new Date().toISOString(),
        rows: pattern.length,
        columns: pattern[0]?.length || 0
      }
    };

    // Write to file with pretty formatting
    await fs.writeFile(file, JSON.stringify(patternObject, null, 2));
    console.log(chalk.green(`✓ Pattern exported to ${file}`));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(chalk.red('Error exporting pattern:'), errorMessage);
    throw error;
  }
}
