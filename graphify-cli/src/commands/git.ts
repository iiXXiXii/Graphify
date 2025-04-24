import * as simpleGit from 'simple-git';

export async function executeGitOperations(date: string, message: string) {
  const git = simpleGit();

  if (!(await git.checkIsRepo())) {
    console.log('Initializing a new Git repository...');
    await git.init();
  }

  await git.addConfig('user.name', 'Graphify Bot');
  await git.addConfig('user.email', 'graphify@example.com');

  await git.add('./*');
  await git.commit(message, { '--date': date });
  console.log('Commit created successfully.');
}
