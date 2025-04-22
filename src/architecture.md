# Graphify Architecture

## Core Structure
```
src/
├── core/                    # Core business logic
│   ├── graphify.ts          # Main class (refactored from Graphify.ts)
│   ├── patterns/            # Pattern generation strategies
│   │   ├── index.ts         # Pattern factory and common interfaces
│   │   ├── random.ts        # Random pattern implementation
│   │   ├── gradient.ts      # Gradient pattern implementation
│   │   └── ...
│   └── analytics/           # Analytics generation
│       ├── index.ts
│       └── reports.ts
├── services/                # External services and integrations
│   ├── git/                 # Git operations
│   │   ├── index.ts
│   │   ├── repository.ts
│   │   └── commit.ts
│   ├── github/              # GitHub specific operations
│   │   ├── index.ts
│   │   └── api.ts
│   └── validation/          # Validation services
│       ├── index.ts
│       └── realism.ts
├── cli/                     # Command-line interface
│   ├── index.ts             # CLI entry point
│   ├── interactive.ts       # Interactive mode
│   ├── commands/            # Command definitions
│   │   ├── index.ts
│   │   ├── generate.ts
│   │   └── analyze.ts
│   └── ui/                  # Terminal UI components
│       ├── index.ts
│       ├── prompts.ts
│       └── displays.ts
├── utils/                   # Utility functions
│   ├── time.ts              # Time utilities
│   ├── date.ts              # Date utilities
│   ├── random.ts            # Random generation utilities
│   ├── file.ts              # File operations
│   └── error.ts             # Error handling
├── config/                  # Configuration
│   ├── index.ts             # Configuration aggregation
│   ├── default.ts           # Default configuration
│   ├── schema.ts            # Configuration schema and validation
│   └── user.ts              # User preferences
├── types/                   # TypeScript type definitions
│   ├── index.ts             # Type exports
│   ├── config.ts            # Configuration types
│   ├── patterns.ts          # Pattern types
│   └── git.ts               # Git-related types
├── app.ts                   # Application entry point
└── index.ts                 # Public API
```

## Module Dependencies

```
index.ts ──────────┐
                   ▼
               app.ts
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
     core/       cli/        config/
       │           │           │
       │        commands/ ◄────┘
       │           │
       └─────► services/
                   │
                   ▼
                 utils/
```

## Component Responsibilities

### Core
- Contains the central business logic
- Implements pattern generation strategies
- Generates analytics reports
- Remains independent of CLI specifics

### Services
- Abstracts external dependencies
- Handles Git operations
- Provides validation services
- Manages GitHub API interactions

### CLI
- Parses command line arguments
- Provides interactive mode
- Renders terminal UI elements
- Implements command handlers

### Utils
- Provides reusable utility functions
- Handles date/time operations
- Manages file operations
- Implements error handling

### Config
- Defines configuration schema
- Provides default values
- Handles user preferences
- Validates configuration

### Types
- Defines TypeScript interfaces
- Ensures type safety across modules
- Facilitates code documentation

## Key Improvements

1. **Separation of Concerns**: Each module has a clear responsibility
2. **Modularity**: Components are interchangeable and independently testable
3. **Scalability**: New patterns and features can be added with minimal changes
4. **Type Safety**: Comprehensive TypeScript types across the codebase
5. **Testability**: Components designed for easy unit testing

## Workflow

1. User calls `index.ts` (CLI or programmatic API)
2. Configuration is processed and validated
3. Core module generates commit patterns based on config
4. Services handle external operations (Git, GitHub)
5. Analytics are generated based on the created pattern
6. Results are presented to the user via CLI or returned programmatically 