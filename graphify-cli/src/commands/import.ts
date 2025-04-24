import { Command } from '@oclif/core';
import * as fs from 'fs';

export default class Import extends Command {
  static description = 'Import a pattern from a file';

  static args = [
    { name: 'file', required: true, description: 'Path to the pattern file' },
  ];

  async run() {
    const { args } = this.parse(Import);
    const pattern = fs.readFileSync(args.file, 'utf-8');
    this.log(`Pattern imported: ${pattern}`);
  }
}
