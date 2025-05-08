# Graphify

![Graphify Logo](./assets/graphify.png)

## Overview

Graphify is a powerful tool that lets you customize your GitHub contribution graph with patterns and schedules. Create artistic designs, maintain consistent contribution patterns, or just have fun with your GitHub profile - all with an intuitive interface and powerful automation.

**Key Components:**
- 🖥️ **Web Interface**: Design patterns visually with our hosted Angular frontend
- 🔄 **Backend API**: Pre-hosted service for authentication and pattern management
- 🛠️ **CLI Tool**: Lightweight command-line interface for pattern generation and GitHub automation

## Table of Contents

- [Getting Started](#getting-started)
- [Using the CLI](#using-the-cli)
- [Using the Web Interface](#using-the-web-interface)
- [Working with Patterns](#working-with-patterns)
- [Advanced: Self-Hosting](#advanced-self-hosting)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Getting Started

Graphify offers multiple ways to use the application:

### Option 1: Use the Web App (Easiest)

Simply visit [https://graphify-app.vercel.app](https://graphify-app.vercel.app) to start using Graphify right away! No installation required.

### Option 2: Install the CLI Tool Only

```bash
# Install with npm
npm install -g graphify-cli

# Or with bun
bun install -g graphify-cli
```

### Option 3: Clone the Repository (For Contributors)

```bash
git clone https://github.com/yourusername/graphify.git
cd graphify
bun install
```

## Using the CLI

The CLI tool provides a quick and powerful way to manage your GitHub contribution patterns directly from your terminal.

### Authentication (Simple Method)

```bash
# Authenticate with GitHub (opens browser window)
graphify auth
```

The tool will automatically open your default browser and guide you through the authentication process. No need to handle OAuth setup manually.

### Creating Patterns

#### Create a new pattern:

```bash
graphify pattern create --name "My Pattern" --rows 7 --cols 52
```

#### Import a pattern:

```bash
graphify import --file pattern.json
```

#### View and edit patterns:

```bash
# List all patterns
graphify pattern list

# Preview a pattern
graphify pattern view --name "My Pattern"

# Edit a pattern
graphify pattern edit --name "My Pattern"
```

### Generating Commits

Generate commits based on your pattern:

```bash
# Basic commit based on pattern
graphify commit --pattern "My Pattern" --repo "my-repo"

# Custom commit message and date
graphify commit --pattern "My Pattern" --repo "my-repo" --message "Update" --date "2023-01-01"

# Schedule commits for a specific period
graphify commit --pattern "My Pattern" --repo "my-repo" --start-date "2023-01-01" --end-date "2023-12-31"
```

### Available Commands

| Command | Description |
|---------|-------------|
| `auth` | Authenticate with GitHub (browser-based) |
| `pattern create` | Create a new contribution pattern |
| `pattern list` | Show all saved patterns |
| `pattern view` | View a specific pattern |
| `pattern edit` | Edit an existing pattern |
| `pattern delete` | Delete a pattern |
| `import` | Import patterns from files (JSON, CSV, SVG) |
| `commit` | Generate commits based on patterns |

## Using the Web Interface

The Graphify web interface provides an intuitive way to design and manage contribution patterns without any installation.

### Features

1. **Visual Pattern Designer**
   - Design patterns using an interactive grid
   - Choose contribution intensity with color picker
   - Save and load patterns from your account

2. **Pattern Preview**
   - See a realistic preview of how your pattern will look on GitHub
   - Adjust commit frequency and intensity

3. **Pattern Library**
   - Browse community-shared patterns
   - Import/export patterns in multiple formats

4. **Scheduler**
   - Set up automated commit schedules
   - Configure recurring patterns

## Working with Patterns

Patterns are the core of Graphify. They define how your GitHub contribution graph will look.

### Pattern Types

1. **Grid-based Patterns**
   - 2D arrays representing the 7×52 GitHub contribution grid
   - Values 0-4 represent commit intensity (0 = no commits, 4 = maximum intensity)

2. **Time-series Patterns**
   - Define commit counts for specific dates
   - More precise control over commit distribution

### Pattern File Formats

Graphify supports multiple file formats for patterns:

- **JSON**: Full pattern with metadata
- **CSV**: Simple grid representation
- **SVG**: Visual representation that can be imported/exported

Example JSON pattern:

```json
{
  "name": "Heart Pattern",
  "type": "grid",
  "data": [
    [0, 0, 0, 0, 0],
    [0, 1, 0, 1, 0],
    [1, 2, 1, 2, 1],
    [1, 3, 2, 3, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0]
  ]
}
```

## Advanced: Self-Hosting

While the hosted version of Graphify is recommended for most users, you can self-host the entire stack if needed.

### Prerequisites for Self-Hosting

- [Bun](https://bun.sh/) v1.2.10 or later
- [Node.js](https://nodejs.org/) v18 or later
- [Git](https://git-scm.com/)
- PostgreSQL database

### Setting Up Self-Hosted Version

1. **Clone the repository:**

```bash
git clone https://github.com/yourusername/graphify.git
cd graphify
```

2. **Configure Environment Variables:**

Create a `.env` file in the root directory:

```
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
DATABASE_URL=postgresql://username:password@localhost:5432/graphify
FRONTEND_URL=http://localhost:4200
BACKEND_URL=http://localhost:3000
```

3. **Initialize the database:**

```bash
cd backend
npx prisma migrate dev
```

4. **Start the servers:**

```bash
# Start backend
cd backend
npm run start:dev

# Start frontend (in another terminal)
cd frontend
npm start
```

## Troubleshooting

### Common Issues

1. **Authentication Issues**
   - Try clearing your browser cookies and cache
   - Use `graphify auth --reset` to clear stored credentials
   - Check your internet connection

2. **CLI Not Found**
   - Ensure npm/bun global packages are in your PATH
   - Try reinstalling with `npm install -g graphify-cli`

3. **Pattern Import/Export Errors**
   - Verify your file format matches the expected structure
   - Check file permissions

### Getting Help

If you encounter issues:
- Run commands with `--verbose` or `--debug` for more information
- Visit our [GitHub Discussions](https://github.com/yourusername/graphify/discussions) page
- Open an issue with details about your environment and steps to reproduce

## Contributing

We welcome contributions to Graphify! Please see `CONTRIBUTING.md` for guidelines.

## License

This project is licensed under the MIT License.
