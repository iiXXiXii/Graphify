# Graphify CLI

Graphify is a TypeScript-powered CLI tool that allows you to customize GitHub contribution graphs by generating backdated commits.

## Installation

Ensure you have [Bun](https://bun.sh) installed. Then, clone the repository and install dependencies:

```bash
bun install
```

## Usage

### Authenticate with GitHub

Before using the tool, authenticate with GitHub:

```bash
bun run graphify auth
```

### Generate Commits

To generate backdated commits:

```bash
bun run graphify commit --date 2023-01-01 --message "New Year Commit"
```

- `--date`: Specify the date for the commit (format: YYYY-MM-DD).
- `--message`: Provide a custom commit message.
- `--dry-run`: Preview the commit schedule without making changes.

### Help

For a list of available commands and options:

```bash
bun run graphify --help
```

## Development

Run tests to ensure everything is working:

```bash
bun run test
```

## Troubleshooting

- Ensure you have a valid GitHub OAuth app set up with `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in your environment variables.
- If you encounter issues, check the logs or run the tool in verbose mode.

## License

This project is licensed under the MIT License.
