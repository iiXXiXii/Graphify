# Graphify

Customize your GitHub contribution graph with patterns, schedules, and more.

## Prerequisites

- [Bun](https://bun.sh/) (v1.2.10 or later)
- A GitHub account with repositories you want to manage

## Installation

```bash
# Install Bun if you haven't already
curl -fsSL https://bun.sh/install | bash

# Clone this repository
git clone https://github.com/yourusername/graphify.git
cd graphify

# Install all dependencies
bun install
```

## Development

```bash
# Start backend development server
bun run dev:backend

# Start frontend development server
bun run dev:frontend

# Run both concurrently (requires both terminal windows)
bun run dev:frontend & bun run dev:backend
```

## Building for Production

```bash
# Build all components
bun run build
```

## CLI Usage

The Graphify CLI tool helps you manage contribution patterns directly from the command line:

```bash
# After building, you can run the CLI with
./graphify-cli/dist/index.js [command]

# Or install it globally
bun link --global

# Then use it anywhere
graphify [command]
```

## Features

- Design custom contribution patterns
- Schedule commits for GitHub contribution graphs
- Import/export patterns in multiple formats
- Preview how patterns will look on GitHub
- Manage and browse pattern collections

## Project Structure

```
Graphify/
├── backend/         # Backend server (NestJS)
├── frontend/        # Frontend application (Angular)
├── graphify-cli/    # CLI tool (TypeScript)
├── prisma/          # Database schema and migrations
├── README.md        # Project documentation
├── package.json     # Root package configuration
└── tsconfig.json    # TypeScript configuration
```

## Relationship Between Components

- The **CLI Tool** is used to generate and manage GitHub contribution patterns programmatically.
- The **Frontend** provides a graphical interface for designing and visualizing patterns.
- The **Backend** handles authentication, scheduling, and database operations, serving as the bridge between the CLI and frontend.

## Dependency Management

Graphify uses different tools for dependency management across its components. Follow the instructions below to set up each part of the project:

### CLI (graphify-cli)
- **Tool**: [Bun](https://bun.sh)
- **Command**: Run `bun install` in the `graphify-cli` directory to install dependencies.

### Frontend (frontend)
- **Tool**: Node.js with npm
- **Command**: Run `npm install` in the `frontend` directory to install dependencies.

### Backend (backend)
- **Tool**: Node.js with npm
- **Command**: Run `npm install` in the `backend` directory to install dependencies.

### Notes
- Ensure you have both Bun and Node.js installed on your system.
- Use the correct tool for each component to avoid compatibility issues.
- If you encounter dependency conflicts, check the `package.json` files in each directory for version requirements.

## Usage

### CLI Tool

#### Authenticate with GitHub
```bash
bun run graphify auth
```

#### Generate Commits
```bash
bun run graphify commit --date 2023-01-01 --message "New Year Commit"
```

### Frontend

#### Start the Development Server
```bash
cd frontend
npm start
```

### Backend

#### Start the Server
```bash
cd backend
npm run start:dev
```

## Environment Configuration

Create a `.env` file in the root directory with the following variables:

```
GITHUB_CLIENT_ID=<your-client-id>
GITHUB_CLIENT_SECRET=<your-client-secret>
DATABASE_URL=<your-database-url>
```

## Centralized Configuration Management

Graphify uses environment variables for all sensitive and environment-specific configuration (OAuth, database, API endpoints, etc.).

- All config variables are defined in `.env.example`.
- The backend uses a config module (e.g., NestJS ConfigModule) with validation (recommended: Joi) to ensure all required variables are present and valid at startup.
- The frontend uses Angular's `environment.ts` for API endpoints and public config.
- Never commit secrets to version control. Use a secrets manager for production deployments if possible.

## Error Handling and User Feedback

- All user-facing operations (authentication, pattern design, API calls) implement robust error handling.
- The frontend displays user-friendly error messages (e.g., via Angular Material Snackbar) and logs errors for debugging.
- The backend uses global exception filters and returns meaningful error responses.

## Accessibility (a11y)

- The pattern designer and dashboard are fully keyboard-navigable (arrow keys, tab, enter/space for actions).
- Visible focus indicators are provided for all interactive elements.
- ARIA roles and labels are used for screen reader compatibility.
- Accessibility is tested with screen readers and a11y tools.

## Security: Token Handling and API Communication

- All tokens are stored securely (HTTP-only cookies or in-memory; never localStorage/sessionStorage).
- CSRF protection is enforced for all authenticated API calls (e.g., same-site cookies, anti-CSRF tokens).
- Content Security Policy (CSP) headers are set in backend responses to mitigate XSS.
- Dependencies are regularly audited (`npm audit`, `bun audit`).

## Authentication Flow

Graphify uses GitHub OAuth for secure authentication across its components. Below is a detailed explanation of the authentication flow:

1. **OAuth App Setup**:
   - Create a GitHub OAuth app in your GitHub account.
   - Set the callback URL to match your backend server's `/auth/callback` endpoint.

2. **Token Storage**:
   - **CLI**: Tokens are securely stored in a local configuration file.
   - **Frontend**: Tokens are stored in the browser's local storage with encryption.
   - **Backend**: Tokens are encrypted and stored in the database for secure access.

3. **Token Refresh**:
   - The backend automatically refreshes tokens using GitHub's API when they expire.

4. **Security Considerations**:
   - Use HTTPS for all communication to prevent token interception.
   - Restrict OAuth app permissions to only what is necessary.
   - Regularly rotate client secrets and update them in the `.env` file.

5. **Authentication Commands**:
   - CLI: Run `bun run graphify auth` to authenticate and store the token.
   - Frontend: Log in through the web interface to authenticate.

For more details, refer to the [GitHub OAuth documentation](https://docs.github.com/en/developers/apps/building-oauth-apps).

## Dependency Versioning and Management

- All dependencies use [semantic versioning](https://semver.org/) and are explicitly specified in each `package.json`.
- Automated tools like Renovate or Dependabot are recommended for keeping dependencies up to date and secure.
- Regularly run `npm audit` or `bun audit` to check for vulnerabilities.

## API Documentation and Validation

- All REST endpoints are documented using OpenAPI/Swagger; GraphQL endpoints are documented via the auto-generated schema.
- Request/response schemas, error codes, and validation rules are documented and versioned.
- Input validation is enforced on the backend (e.g., with class-validator in NestJS) and on the frontend (Angular forms validation).

## Database Migration and Rollback Strategy

- Database schema changes are managed with [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate).
- Each migration is versioned and can be rolled back using `prisma migrate resolve` and `prisma migrate reset`.
- Migration and rollback procedures are documented for safe deployments.

## Monitoring, Alerting, and Incident Response

- System metrics are collected with Prometheus and visualized in Grafana.
- Actionable alerts are configured for failed commit schedules, authentication errors, and performance bottlenecks.
- Incident response guidelines are documented, including escalation and postmortem procedures.

## Rate Limiting and Abuse Protection

- Rate limiting is enforced per-user and per-IP using backend middleware (e.g., NestJS rate-limiter or API gateway).
- Both burst and sustained rate limits are defined and documented.
- Abuse protection policies are reviewed regularly to ensure fair usage and system protection.

## Summary

The Graphify project follows strong architectural and operational best practices. All dependencies are versioned and updated automatically, APIs are fully documented and validated, database migrations are safe and reversible, and robust monitoring and alerting are in place. Rate limiting and abuse protection are clearly defined, ensuring the system remains reliable and secure as it scales.

## Contribution

We welcome contributions! Please see `CONTRIBUTING.md` for guidelines.

## License

This project is licensed under the MIT License.
