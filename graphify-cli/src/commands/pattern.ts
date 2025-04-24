import { Command, Flags } from '@oclif/core';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as inquirer from 'inquirer';
import chalk from 'chalk';
import { validatePattern } from '../utils/scheduler';

export default class Pattern extends Command {
  static description = 'Create, import, and manage patterns';

  static examples = [
    '$ graphify pattern import --file pattern.json',
    '$ graphify pattern create',
    '$ graphify pattern export mypattern.json'
  ];

  static flags = {
    file: Flags.string({
      char: 'f',
      description: 'Path to pattern file for import/export',
      required: false,
    })
  };

  static args = [
    {
      name: 'action',
      required: true,
      description: 'Action to perform (import, export, create, view)',
      options: ['import', 'export', 'create', 'view']
    },
    {
      name: 'filename',
      required: false,
      description: 'Filename for export'
    }
  ];

  async run() {
    const { args, flags } = await this.parse(Pattern);

    try {
      switch (args.action) {
        case 'import':
          await this.importPattern(flags.file);
          break;
        case 'export':
          await this.exportPattern(args.filename || flags.file);
          break;
        case 'create':
          await this.createPattern(args.filename || flags.file);
          break;
        case 'view':
          await this.viewPattern(flags.file);
          break;
        default:
          console.error(chalk.red(`Unknown action: ${args.action}`));
          this.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      this.exit(1);
    }
  }

  async importPattern(file?: string) {
    if (!file) {
      const { filepath } = await inquirer.prompt({
        type: 'input',
        name: 'filepath',
        message: 'Enter the path to the pattern file:',
        validate: (input) => input ? true : 'Please provide a file path'
      });
      file = filepath;
    }

    try {
      // Ensure file exists
      const stats = await fs.stat(file).catch(() => {
        throw new Error(`File not found: ${file}`);
      });

      if (!stats.isFile()) {
        throw new Error(`Not a file: ${file}`);
      }

      // Read and parse the file with detailed error handling
      const fileContent = await fs.readFile(file, 'utf-8');
      let pattern;

      try {
        pattern = JSON.parse(fileContent);
      } catch (e) {
        throw new Error(`Invalid JSON format: ${e.message}`);
      }

      // Handle different pattern formats
      let patternGrid;

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
      else if (pattern.pattern) {
        if (Array.isArray(pattern.pattern)) {
          patternGrid = Array.isArray(pattern.pattern[0])
            ? pattern.pattern
            : [pattern.pattern];
        } else {
          throw new Error('Invalid pattern format: "pattern" property is not an array');
        }
      }
      // Object with grid property
      else if (pattern.grid) {
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
        validationIssues.forEach(issue => console.log(chalk.dim(`  - ${issue}`)));

        const { continueAnyway } = await inquirer.prompt({
          type: 'confirm',
          name: 'continueAnyway',
          message: 'Use this pattern anyway?',
          default: !validationIssues.some(i => i.includes('Invalid'))
        });

        if (!continueAnyway) {
          throw new Error('Pattern import aborted due to validation issues');
        }
      }

      // Display pattern info
      console.log(chalk.green('✓ Pattern imported successfully'));
      console.log(`Dimensions: ${patternGrid.length} rows × ${patternGrid[0].length} columns`);
      console.log(`Total cells: ${patternGrid.length * patternGrid[0].length}`);

      // Display ASCII visualization of pattern for preview
      console.log('\nPattern preview:');
      this.printPatternPreview(patternGrid);

      return patternGrid;
    } catch (error) {
      console.error(chalk.red('Error importing pattern:'), error.message);
      throw error;
    }
  }

  async exportPattern(file?: string) {
    // Create a pattern first
    const pattern = await this.promptForPattern();

    if (!file) {
      const { filepath } = await inquirer.prompt({
        type: 'input',
        name: 'filepath',
        message: 'Enter the path to save the pattern:',
        default: 'pattern.json',
        validate: (input) => input ? true : 'Please provide a file path'
      });
      file = filepath;
    }

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
          columns: pattern[0].length
        }
      };

      // Write to file with pretty formatting
      await fs.writeFile(file, JSON.stringify(patternObject, null, 2));
      console.log(chalk.green(`✓ Pattern exported to ${file}`));
    } catch (error) {
      console.error(chalk.red('Error exporting pattern:'), error.message);
      throw error;
    }
  }

  async createPattern(file?: string) {
    console.log(chalk.blue('Creating a new pattern...'));

    const pattern = await this.promptForPattern();

    // Display pattern preview
    console.log('\nPattern preview:');
    this.printPatternPreview(pattern);

    // Ask to save the pattern
    const { savePattern } = await inquirer.prompt({
      type: 'confirm',
      name: 'savePattern',
      message: 'Would you like to save this pattern?',
      default: true
    });

    if (savePattern) {
      if (!file) {
        const { filepath } = await inquirer.prompt({
          type: 'input',
          name: 'filepath',
          message: 'Enter the path to save the pattern:',
          default: 'pattern.json',
          validate: (input) => input ? true : 'Please provide a file path'
        });
        file = filepath;
      }

      await this.exportPattern(file);
    }

    return pattern;
  }

  async viewPattern(file?: string) {
    if (!file) {
      const { filepath } = await inquirer.prompt({
        type: 'input',
        name: 'filepath',
        message: 'Enter the path to the pattern file:',
        validate: (input) => input ? true : 'Please provide a file path'
      });
      file = filepath;
    }

    try {
      const pattern = await this.importPattern(file);
      console.log('\nPattern details:');
      this.printPatternPreview(pattern);
    } catch (error) {
      console.error(chalk.red('Error viewing pattern:'), error.message);
      throw error;
    }
  }

  async promptForPattern() {
    const { patternType } = await inquirer.prompt({
      type: 'list',
      name: 'patternType',
      message: 'Choose a pattern type:',
      choices: [
        { name: 'Simple (one intensity level)', value: 'simple' },
        { name: 'Custom grid (multiple intensity levels)', value: 'custom' }
      ]
    });

    if (patternType === 'simple') {
      const { rows, columns, intensity } = await inquirer.prompt([
        {
          type: 'number',
          name: 'rows',
          message: 'Number of rows:',
          default: 5,
          validate: (input: number) =>
            input > 0 && input <= 20 ? true : 'Please enter a number between 1 and 20'
        },
        {
          type: 'number',
          name: 'columns',
          message: 'Number of columns:',
          default: 7,
          validate: (input: number) =>
            input > 0 && input <= 30 ? true : 'Please enter a number between 1 and 30'
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

      // Create a pattern with uniform intensity
      return Array(rows).fill(0).map(() => Array(columns).fill(intensity));
    } else {
      console.log(chalk.blue('Creating a custom grid pattern:'));
      console.log(chalk.dim('Use 0-4 for intensity levels (0 = no commits, 4 = maximum intensity)'));

      const { rows, columns, inputMethod } = await inquirer.prompt([
        {
          type: 'number',
          name: 'rows',
          message: 'Number of rows:',
          default: 5,
          validate: (input: number) =>
            input > 0 && input <= 10 ? true : 'Please enter a number between 1 and 10'
        },
        {
          type: 'number',
          name: 'columns',
          message: 'Number of columns:',
          default: 7,
          validate: (input: number) =>
            input > 0 && input <= 20 ? true : 'Please enter a number between 1 and 20'
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
          default: rows * columns <= 25 ? 'cell' : 'uniform'
        }
      ]);

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
              pattern[i][j] = value;
            }
          }
          break;

        case 'uniform':
          // Fill with a uniform value
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
            for (let j = 0; j < columns; j++) {
              pattern[i][j] = value;
            }
          }
          break;

        case 'random':
          // Fill with random values
          for (let i = 0; i < rows; i++) {
            for (let j = 0; j < columns; j++) {
              pattern[i][j] = Math.floor(Math.random() * 5); // Random 0-4
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
            pattern[i] = values;
          }
          break;
      }

      return pattern;
    }
  }

  printPatternPreview(pattern: number[][]) {
    const colorMap = [
      chalk.dim('□'),        // 0: No commits
      chalk.green('▫'),      // 1: Light
      chalk.green('▪'),      // 2: Medium
      chalk.green.bold('■'), // 3: Heavy
      chalk.bgGreen('■')     // 4: Maximum
    ];

    const rows = pattern.length;
    const cols = pattern[0].length;

    // Print column numbers
    console.log('   ' + Array.from({ length: cols }, (_, i) => (i % 5 === 0 ? (i/5).toString() : ' ')).join(''));
    console.log('   ' + Array.from({ length: cols }, (_, i) => i % 5).join(''));

    // Print pattern
    for (let i = 0; i < rows; i++) {
      const rowStr = pattern[i].map(cell => colorMap[cell]).join(' ');
      console.log(`${i.toString().padStart(2)} ${rowStr}`);
    }
  }
}
