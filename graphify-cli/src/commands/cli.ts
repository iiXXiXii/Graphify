import { Command } from 'commander';
import { prompt } from 'inquirer';
import { executeGitOperations } from './git';
import { validateDateInput, parseDate } from './date';
import { authenticateWithGitHub } from './auth';

const program = new Command();

program
  .name('graphify')
  .description('Customize GitHub contribution graphs by generating backdated commits')
  .version('1.0.0');

program
  .command('commit')
  .description('Generate backdated commits')
  .option('-d, --date <date>', 'Specify the date for the commit')
  .option('-m, --message <message>', 'Specify a custom commit message')
  .option('--dry-run', 'Preview the commit schedule without making changes')
  .action(async (options) => {
    try {
      const date = options.date ? validateDateInput(options.date) : await promptForDate();
      const parsedDate = parseDate(date);
      const message = options.message || `Automated commit on ${date}`;

      if (options.dryRun) {
        console.log('Dry Run:');
        console.log(`Date: ${parsedDate}`);
        console.log(`Message: ${message}`);
        return;
      }

      await executeGitOperations(parsedDate, message);
      console.log('Commits generated successfully!');
    } catch (error) {
      console.error('Error:', error.message);
    }
  });

program
  .command('auth')
  .description('Authenticate with GitHub')
  .action(async () => {
    try {
      await authenticateWithGitHub();
      console.log('You are now authenticated with GitHub.');
    } catch (error) {
      console.error('Authentication failed:', error.message);
    }
  });

async function promptForDate() {
  const response = await prompt({
    type: 'input',
    name: 'date',
    message: 'Enter the date for the commit (YYYY-MM-DD):',
  });
  return response.date;
}

program.parse(process.argv);
