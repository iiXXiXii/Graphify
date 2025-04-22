import chalk from 'chalk';
import { ThemeManager } from '../themes/theme';

/**
 * UI components for consistent terminal formatting
 */
export class UIComponents {
  private theme: ThemeManager;

  constructor() {
    this.theme = ThemeManager.getInstance();
  }

  /**
   * Generate a header for the application
   * @returns Formatted header string
   */
  header(): string {
    const divider = '═'.repeat(60);
    return `\n${this.theme.primary(divider)}\n${this.theme.logo('  GRAPHIFY')} ${this.theme.secondary('- GitHub Contribution Graph Generator')}\n${this.theme.primary(divider)}\n`;
  }

  /**
   * Generate a section header
   * @param title Section title
   * @returns Formatted section header string
   */
  sectionHeader(title: string): string {
    return `\n${this.theme.primary('┌' + '─'.repeat(58) + '┐')}\n${this.theme.primary('│')} ${this.theme.heading(` ${title} `)}${' '.repeat(Math.max(0, 57 - title.length))}${this.theme.primary('│')}\n${this.theme.primary('└' + '─'.repeat(58) + '┘')}\n`;
  }

  /**
   * Generate a labeled value
   * @param label The label
   * @param value The value
   * @returns Formatted label:value string
   */
  labeledValue(label: string, value: string): string {
    return `${this.theme.label(label + ':')} ${value}`;
  }

  /**
   * Format a list item with optional indentation
   * @param text The list item text
   * @param indentation The indentation level (0 = no indent)
   * @returns Formatted list item string
   */
  listItem(text: string, indentation: number = 0): string {
    const indent = '  '.repeat(indentation);
    const bullet = indentation === 0 ? '•' : '◦';
    return `${indent}${this.theme.accent(bullet)} ${text}`;
  }

  /**
   * Format a code block
   * @param code The code to format
   * @returns Formatted code block string
   */
  codeBlock(code: string): string {
    const lines = code.split('\n');
    const width = Math.max(...lines.map(line => line.length), 40);

    let result = this.theme.code('┌' + '─'.repeat(width + 2) + '┐') + '\n';

    for (const line of lines) {
      result += this.theme.code('│ ') + chalk.white(line) + ' '.repeat(width - line.length + 1) + this.theme.code('│') + '\n';
    }

    result += this.theme.code('└' + '─'.repeat(width + 2) + '┘');
    return result;
  }

  /**
   * Format an error message
   * @param message The error message
   * @returns Formatted error string
   */
  error(message: string): string {
    return this.theme.error(`✖ ${message}`);
  }

  /**
   * Format a warning message
   * @param message The warning message
   * @returns Formatted warning string
   */
  warning(message: string): string {
    return this.theme.warning(`⚠ ${message}`);
  }

  /**
   * Format a success message
   * @param message The success message
   * @returns Formatted success string
   */
  success(message: string): string {
    return this.theme.success(`✓ ${message}`);
  }

  /**
   * Format an info message
   * @param message The info message
   * @returns Formatted info string
   */
  info(message: string): string {
    return this.theme.info(`ℹ ${message}`);
  }

  /**
   * Create a table-like structure for data visualization
   * @param headers Table headers
   * @param rows Table rows
   * @param columnWidths Optional column widths
   * @returns Formatted table string
   */
  table(headers: string[], rows: string[][], columnWidths?: number[]): string {
    // Calculate column widths if not provided
    if (!columnWidths) {
      columnWidths = headers.map((header, index) => {
        const maxCellWidth = Math.max(
          header.length,
          ...rows.map(row => (row[index] || '').length)
        );
        return maxCellWidth + 2; // Add padding
      });
    }

    const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0) + columnWidths.length + 1;

    // Create header row
    let result = this.theme.table('┌' + columnWidths.map(w => '─'.repeat(w)).join('┬') + '┐') + '\n';

    result += this.theme.table('│');
    headers.forEach((header, i) => {
      const paddedHeader = ` ${header}${' '.repeat(Math.max(0, columnWidths[i] - header.length - 2))} `;
      result += this.theme.tableHeader(paddedHeader) + this.theme.table('│');
    });
    result += '\n';

    result += this.theme.table('├' + columnWidths.map(w => '─'.repeat(w)).join('┼') + '┤') + '\n';

    // Create data rows
    rows.forEach(row => {
      result += this.theme.table('│');
      row.forEach((cell, i) => {
        const paddedCell = ` ${cell}${' '.repeat(Math.max(0, columnWidths[i] - cell.length - 2))} `;
        result += paddedCell + this.theme.table('│');
      });
      result += '\n';
    });

    result += this.theme.table('└' + columnWidths.map(w => '─'.repeat(w)).join('┴') + '┘');

    return result;
  }

  /**
   * Format a progress bar
   * @param current Current value
   * @param total Total value
   * @param width Width of the progress bar in characters
   * @returns Formatted progress bar string
   */
  progressBar(current: number, total: number, width: number = 40): string {
    const percentage = Math.min(100, Math.round((current / total) * 100));
    const filledWidth = Math.round((percentage / 100) * width);
    const emptyWidth = width - filledWidth;

    const filled = '█'.repeat(filledWidth);
    const empty = '░'.repeat(emptyWidth);

    return `${this.theme.progressBar(`${filled}${empty}`)} ${this.theme.progressText(`${percentage}%`)}`;
  }

  /**
   * Format a help command description
   * @param command Command name
   * @param description Command description
   * @param usage Optional usage example
   * @returns Formatted command help string
   */
  commandHelp(command: string, description: string, usage?: string): string {
    let result = this.theme.commandName(command) + '\n';
    result += `  ${description}\n`;

    if (usage) {
      result += `  ${this.theme.label('Usage:')} ${this.theme.code(usage)}\n`;
    }

    return result;
  }

  /**
   * Format a key-value option description
   * @param key Option key/flag
   * @param value Option value description
   * @param defaultValue Option default value (optional)
   * @returns Formatted option description string
   */
  optionHelp(key: string, value: string, defaultValue?: string): string {
    let result = `  ${this.theme.optionFlag(key)}  ${value}`;

    if (defaultValue !== undefined) {
      result += ` (default: ${this.theme.optionDefault(defaultValue)})`;
    }

    return result;
  }
}
