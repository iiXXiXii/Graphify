# Graphify

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue.svg)](https://www.typescriptlang.org/)
[![Luxon](https://img.shields.io/badge/luxon-3.4.3-green.svg)](https://moment.github.io/luxon/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

Graphify is a powerful TypeScript tool that lets you customize your GitHub contribution graph with intelligent commit patterns. Create beautiful contribution patterns, fill in your history, or just make your GitHub profile look more active - all with built-in safeguards to maintain authenticity.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Patterns](#patterns)
- [Advanced Features](#advanced-features)
- [Safety Features](#safety-features)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Introduction

Graphify is a complete rewrite of the original project in TypeScript, offering better type safety, modern libraries, and significantly improved functionality. The project uses [Luxon](https://moment.github.io/luxon/) for date manipulation and [simple-git](https://github.com/steveukx/git-js) for Git operations.

## Features

- **Beautiful Contribution Patterns** - Create eye-catching patterns on your GitHub graph
- **Realistic Developer Simulation** - Emulate genuine developer activity including vacations and work cycles
- **Smart Safety Features** - Built-in protections against suspicious-looking contributions
- **Intelligent Commit Messages** - Generate authentic-looking commit messages
- **Flexible Configuration** - Customize every aspect of your contribution pattern
- **Time Awareness** - Respect typical working hours and maintain realistic commit timing
- **Analytics** - Get insights into your contribution pattern

## Installation

### From NPM

```bash
npm install -g graphify
```

### From Source

Clone and fork the repository to make changes in your local system:

```bash
git clone https://github.com/iiXXiXii/Graphify.git
cd Graphify
```

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Link for local development:

```bash
npm link
```

## Usage

### Basic Usage

Run Graphify with default settings:

```bash
npx graphify
# or if installed globally
graphify
```

### With Options

```bash
graphify --count 150 --pattern gradient
```

Create a realistic developer activity pattern:

```bash
graphify --pattern realistic --simulate-vacations --respect-holidays
```

Avoid pushing to remote repository (local commits only):

```bash
graphify --no-push
```

Focus on weekends with higher commit frequency:

```bash
graphify --active-days 0,6 --frequency 3
```

### API Usage

You can also use Graphify in your own projects:

```typescript
import { initialize } from 'graphify';

// Initialize with custom options
initialize({
  commitCount: 200,
  pattern: 'heart',
  maxWeeks: 40,
  maxDays: 5,
  pushToRemote: false, // Don't push to remote
  useRealisticTimestamps: true,
  timeOfDay: 'working-hours',
  preventFutureCommits: true
}).then(() => {
  console.log('Graphify completed!');
}).catch(err => {
  console.error('Error:', err);
});
```

## Patterns

Graphify supports several contribution patterns:

### Random

The default pattern that randomly distributes commits across the selected date range with focus on active days.

```bash
graphify --pattern random
```

### Gradient

Creates a gradient effect with more commits in recent dates and fewer in older dates.

```bash
graphify --pattern gradient
```

### Snake

Creates a snake-like pattern that zigzags across your contribution graph.

```bash
graphify --pattern snake
```

### Heart

Concentrates commits in the middle of your date range, creating a heart-like distribution.

```bash
graphify --pattern heart
```

### Realistic

Simulates typical developer activity with natural ebbs and flows of productivity.

```bash
graphify --pattern realistic
```

### Steady

Creates a consistent, reliable contribution pattern across all dates.

```bash
graphify --pattern steady
```

### Crescendo

Starts with minimal activity and gradually increases over time.

```bash
graphify --pattern crescendo
```

### Custom (Experimental)

Support for custom patterns is in development. This will allow you to define your own contribution pattern.

## Advanced Features

Graphify includes several advanced features to create more realistic commit patterns:

### Realistic Timestamps

Commits are created with realistic timestamps based on time-of-day preferences:

```bash
graphify --time-of-day working-hours  # Default: 9am-6pm
graphify --time-of-day morning        # 8am-12pm
graphify --time-of-day evening        # 6pm-10pm
```

### Developer Life Simulation

Simulate the natural patterns of developer life:

```bash
# Add vacation periods
graphify --simulate-vacations --vacation-count 3 --max-vacation-length 10

# Respect holidays (no commits on holidays)
graphify --respect-holidays --holiday-country US

# Simulate development cycles (sprints)
graphify --simulate-dev-cycles --cycle-length 14

# Simulate project lifecycle
graphify --project-lifecycle startup  # More activity at beginning
graphify --project-lifecycle maintenance  # Low activity with occasional spikes
graphify --project-lifecycle active-development  # Consistent high activity
```

### Realistic Commit Messages

Generate authentic-looking commit messages:

```bash
# Use built-in commit message generator
graphify  # Default behavior

# Use custom commit message templates
graphify --commit-messages my-templates.txt
```

### Analytics

Get insights into your contribution pattern:

```bash
graphify --pattern realistic  # Analytics shown by default
graphify --no-analytics       # Disable analytics
```

## Safety Features

Graphify includes several safety features to maintain authenticity:

### Future Date Prevention

By default, Graphify prevents creating commits with future dates:

```bash
graphify  # Future dates are automatically prevented

# Override (not recommended)
graphify --allow-future-commits
```

### Realistic Distribution Validation

Contributions are validated to ensure they look realistic:

```bash
graphify  # Distribution validation enabled by default

# Disable validation
graphify --no-validation
```

### Commit Frequency Limits

Warnings are shown if commit frequency would look suspicious:

```bash
graphify --frequency 20  # Will show warning about suspicious frequency
```

## Configuration

Graphify accepts a wide range of configuration options:

| Category | Option | Description | Default |
|----------|--------|-------------|---------|
| **Basic** | `--count <number>` | Number of commits to generate | 100 |
| | `--repo <path>` | Path to local git repository | Current directory |
| | `--data-file <path>` | Path to data file | ./data.json |
| | `--branch <name>` | Remote branch name | Auto-detected current branch |
| | `--no-push` | Don't push to remote repository | Push enabled by default |
| **Patterns** | `--pattern <name>` | Commit pattern type | random |
| | `--frequency <number>` | Commits per active day | 1 |
| | `--active-days <list>` | Days of week for commits (0=Sun, 6=Sat) | 1,2,3,4,5 (Mon-Fri) |
| **Time** | `--time-of-day <time>` | When to make commits | working-hours |
| | `--min-time-between <min>` | Minimum minutes between commits on same day | 30 |
| | `--no-realistic-timestamps` | Disable realistic time generation | Enabled by default |
| **Date Range** | `--start-date <date>` | Start date for commits (ISO format) | 1 year ago |
| | `--end-date <date>` | End date for commits (ISO format) | today |
| **Simulation** | `--simulate-vacations` | Add periods with no commits | Disabled by default |
| | `--respect-holidays` | Skip commits on common holidays | Disabled by default |
| | `--simulate-dev-cycles` | Simulate development cycle patterns | Disabled by default |
| | `--project-lifecycle <type>` | Adjust activity based on project lifecycle | none |
| **Safety** | `--allow-future-commits` | Allows commits with future dates | Disabled by default |
| | `--no-validation` | Disable commit distribution validation | Validation enabled by default |

For a full list of options, run:

```bash
graphify --advanced-help
```

## Troubleshooting

### Git Issues

If you encounter Git-related issues:

1. **Error pushing to remote**: Make sure your repository has the correct remote set up and you have the right permissions
   ```bash
   git remote -v
   ```

2. **Branch does not exist**: Graphify will automatically detect your current branch
   ```bash
   # Verify your current branch
   git branch
   ```

3. **Local commits only**: If you just want to create local commits without pushing
   ```bash
   graphify --no-push
   ```

### Other Common Issues

1. **Command not found**: If the `graphify` command isn't found, make sure it's installed correctly
   ```bash
   # Install globally
   npm install -g graphify
   
   # Or use npx
   npx graphify
   ```

2. **Date-related issues**: Graphify defaults to the last year for date ranges. Specify explicitly if needed
   ```bash
   # Create commits for a specific date range
   graphify --start-date 2023-01-01 --end-date 2023-12-31
   ```

3. **Future date warnings**: Graphify prevents commits with future dates by default
   ```bash
   # Only if you really need this (not recommended)
   graphify --allow-future-commits
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

MIT
