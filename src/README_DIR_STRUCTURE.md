# Graphify `/src/` Directory Structure (Post-Cleanup)

This directory contains only **up-to-date, ESM-compliant, modern source files**.
Legacy files, patterns, incomplete plugins, and old schemas have been **removed** as per `CODEBASE_CLEANUP_PLAN.md`.

## Current Structure

```
src/
├── cli/                  -- CLI interface
│   └── cli.ts            -- Modern CLI implementation using Commander
├── config/               -- Configuration
│   └── default.ts        -- Default configuration values
├── plugins/              -- Plugin system
│   ├── interface.ts      -- Plugin registry and interface
│   ├── randomPattern.ts  -- Random pattern implementation
│   └── ...               -- Other pattern implementations
├── types/                -- Type definitions
│   └── config.ts         -- Single source of truth for all types
├── utils/                -- Utility functions
│   ├── errorHandler.ts   -- Centralized error handler
│   └── ...               -- Other utilities
├── index.ts              -- Main entry point and exports
└── Graphify.ts           -- Core Graphify class
```

## Design Principles

1. **ESM-Compatible**: All imports use `.js` extensions for ESM compatibility
2. **Single Source of Truth**: All types are defined in `types/config.ts`
3. **Centralized Error Handling**: All errors go through `utils/errorHandler.ts`
4. **Plugin Architecture**: Patterns are implemented as plugins
5. **Type Safety**: Comprehensive TypeScript types throughout

## How to Add New Features

1. **New Patterns**: Create a new file in `plugins/` that implements the `PatternPlugin` interface
2. **New Commands**: Extend the CLI in `cli/cli.ts`
3. **New Utilities**: Add to the `utils/` directory
4. **Config Updates**: Update both `types/config.ts` and `config/default.ts`

## Testing

Tests are in the `tests/` directory at the project root. All tests are ESM-compatible.
