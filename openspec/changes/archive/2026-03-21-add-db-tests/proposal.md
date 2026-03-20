## Why

The `src/lib/db/` module has no test coverage — repository functions, the query builder, and settings helpers are used throughout the app but have never been verified in isolation. Adding tests now establishes a safety net before the module grows further and makes regressions detectable without running the full Tauri app.

## What Changes

- Add `vitest` as a dev dependency (Vite's native test runner — zero extra config needed since Vite is already in use)
- Add `@tauri-apps/plugin-sql` mock so tests can run in Node without a real SQLite file
- Add unit tests for `QueryBuilder` (filter, orderBy, limit, offset, IN operator, all/first/count terminals)
- Add unit tests for `SqliteDatabase` CRUD methods (get, insert, upsert, remove, select, execute)
- Add unit tests for settings helpers (`getSetting`, `setSetting`)
- Add integration-style unit tests for each repository module (projects, conversations, messages, artifacts, llm-providers)
- Add a `test` script to `package.json`

## Capabilities

### New Capabilities

- `db-test-suite`: Unit test suite for the db module using Vitest with a mocked `@tauri-apps/plugin-sql` backend

### Modified Capabilities

<!-- None — no spec-level requirement changes to existing capabilities -->

## Impact

- **New dev dependency**: `vitest` (Vite ecosystem, no webpack/jest conflict)
- **New files**: `src/lib/db/__tests__/` directory with test files per module
- **New file**: `src/lib/db/__mocks__/@tauri-apps/plugin-sql.ts` (or `vitest.setup.ts` with `vi.mock`)
- **`package.json`**: new `test` and `test:watch` scripts
- **`vite.config.ts`**: add `test` config block (vitest inline config)
- No changes to production source files
