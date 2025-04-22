# Contributing to Graphify

Thank you for your contribution!

## Workflow

- Fork and clone this repo
- `npm install`
- Write code in `src/`, tests in `tests/`
- Add/Update exports via `src/index.ts` as needed
- `npm run lint` and `npm run build`
- Commit, push, and PR

## Tests

- All new modules or plugins should have tests
- Run all tests: `npm test`
- Coverage report: `npm run test:coverage`

## Coding Standards

- Use strict TypeScript (`noImplicitAny`, etc)
- Format via Prettier (`npm run format`)
- ESM imports only (`import ... from ...` with `.js` extension)

## Plugin Guidelines

- Implement `PatternPlugin` interface (see `src/plugins/interface.ts`)
- Register in `src/plugins/manager.ts`
- Add unit and E2E tests for new plugin

## Dependency Updates

- Keep all core libraries up to date
- If using new dependencies, update `package.json` and document rationale in PR

---

By contributing you agree to the project license.
