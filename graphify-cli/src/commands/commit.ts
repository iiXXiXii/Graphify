import { Command } from '@oclif/core';
import * as simpleGit from 'simple-git';

export default class Commit extends Command {
  static description = 'Execute commits based on a pattern';

  async run() {
    const git = simpleGit();
    await git.init();
    await git.add('./*');
    await git.commit('Automated commit from Graphify');
    this.log('Commits executed successfully.');
  }
}
