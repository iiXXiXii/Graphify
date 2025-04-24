import { Command } from '@oclif/core';
import * as enquirer from 'enquirer';

export default class Pattern extends Command {
  static description = 'Manage patterns for your contribution graph';

  async run() {
    const response = await enquirer.prompt({
      type: 'input',
      name: 'patternName',
      message: 'Enter the name of your pattern:',
    });

    this.log(`Pattern created: ${response.patternName}`);
  }
}
