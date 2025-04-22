# Graphify `/src/` Directory Skeleton (Post-Cleanup)

This directory contains only **up-to-date, ESM-compliant, modern source files**.
Legacy files, patterns, incomplete plugins, and old schemas have been **removed** as per `CODEBASE_CLEANUP_PLAN.md`.

## Present:

- `/cli/cli.ts`      -- Modern CLI workflow, Commander, entry point
- `/types/config.ts` -- The _only_ config/type source of truth (imported by all modules)
- `/utils/errorHandler.ts` -- Central error/log handler
- `/index.ts`        -- Entrypoint, loads config and wiring
- `/README_DIR_STRUCTURE.md` -- This file, explains the scaffold

## How to Grow the Codebase

1. **Config**: Expand or validate in `/types/config.ts` only.
2. **Plugins**: Place in `/plugins/`, document interface in `/plugins/interface.ts`.
3. **Domain/Core**: Only working, up-to-date files and services.
4. **Error Handling**: Always use `ErrorHandler`.
5. **Tests**: Add working, ESM-native `.ts` tests in `/tests/`.

**See `CODEBASE_CLEANUP_PLAN.md` and `CODEBASE_REVIEW_AND_PLAN.md` for more.**
