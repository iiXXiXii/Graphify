# Graphify Codebase Cleanup & Modernization Plan

## 1. Delete All Legacy/Obsolete Files

**Delete these files/directories if present:**
- `src/cli/commands/`
- `src/cli/ui/`
- `src/config/schema.ts`
- `src/config/user.ts` (optional, check if it's legacy)
- `src/plugins/patterns/`
- `src/core/patterns/`
- `src/core/analytics/`
- `src/domain/analytics/`
- `src/domain/patterns/`
- `src/models/`
- `src/core/graphify.ts`
- Any file named `basePatternPlugin.ts`, `randomPattern.ts`, `realisticPattern.ts` under plugins or patterns
- Any file or directory that is not part of up-to-date working features/artifacts

## 2. Update CLI and Sources

- Go through all CLI files (`src/cli/index.ts`, `src/cli/interactive.ts`, etc.) and ensure they:
  - Use only valid imports (if a referenced file is missing or deleted, remove the import and related code)
  - Do **not** import from legacy modules (commands, ui, patterns, models, schema)
  - Stub or minimalize any file that had >70% of its logic tied to deleted code

## 3. Jest & ESM/TS Config

- Add or update `jest.config.mjs` (see separate artifact)
- In `package.json`, add/ensure: `"type": "module"`
- All test files must use `.ts` or `.mts` and native ESM imports

## 4. Remove Invalid Imports

- For any `import ... from "..."` where the path/module does not exist, delete the import _and_ all references in each file

## 5. Clean/Align Tests

- Only keep tests (`tests/`) that use modern, working modules
- Remove any test referencing removed modules, or update to use stubs/real implementations

## 6. NPM Workflow

- Run: `npm install`, `npm run build`, `npm test`
- If builds/tests fail due to missing imports or ESM config: 
  - re-run the cleanup, check configs again

---

## Ready for ESM-strict, error-free, modern TypeScript/Jest development 🚀
