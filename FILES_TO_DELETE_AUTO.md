# Files/Directories to Delete

Delete these obsolete or legacy files—and remove any dangling imports to them in any other files:

- `src/cli/commands/` _(entire directory)_
- `src/cli/ui/` _(entire directory)_
- `src/config/schema.ts`
- `src/plugins/patterns/` _(entire directory)_
- `src/core/patterns/` _(entire directory)_
- `src/core/analytics/` _(entire directory)_
- `src/domain/analytics/` _(entire directory)_
- `src/domain/patterns/` _(entire directory)_
- `src/models/` _(entire directory, if present)_
- `src/core/graphify.ts`

**PLUS**:  
- Every `import ... from "<removed file>"` (fix or delete the statement)

**Also double-check (per project evolution):**
- Any ".js" file in `src/`
- Code referencing anything from above directories/files

---
_This list synthesizes all user, context, and FILES_TO_DELETE.md-reviewed details. Execute before running, building, or testing._
