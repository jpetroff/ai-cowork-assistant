## Context

The db module (`src/lib/db/`) is built on `@tauri-apps/plugin-sql`, which wraps a native Tauri SQLite driver. The plugin calls the Tauri IPC bridge at runtime, so tests cannot hit a real database without a running Tauri process. Vite is already the build tool; Vitest is Vite's co-located test runner and requires minimal extra configuration.

No test infrastructure exists today — no test script, no vitest config, no mocks.

## Goals / Non-Goals

**Goals:**
- Run `bun test` entirely in Node (no Tauri process, no Electron)
- Cover `QueryBuilder` SQL generation logic (unit)
- Cover `SqliteDatabase` method contracts via a mocked plugin (unit)
- Cover settings helpers (`getSetting`, `setSetting`) via the same mock
- Cover every repository function's SQL and return values (unit with mock)
- Keep tests fast: no file I/O, no network, no native binary

**Non-Goals:**
- End-to-end or integration tests against a real SQLite file
- Testing the Tauri plugin itself
- UI component tests (separate concern)
- Coverage thresholds or CI enforcement (can be added later)

## Decisions

### 1. Vitest over Jest

**Decision**: Use Vitest.

**Rationale**: Vitest shares the Vite config (alias `@/` already works), supports ESM natively, and runs without a separate Babel/TS transform step. Jest requires `ts-jest` or `babel-jest` and doesn't natively understand Vite aliases — adding it would mean maintaining two transform pipelines.

**Alternative considered**: Jest with `ts-jest` — rejected due to config overhead and ESM friction with Tauri's plugin packages.

### 2. Mock `@tauri-apps/plugin-sql` via `vi.mock`

**Decision**: Use a manual `vi.mock('@tauri-apps/plugin-sql', ...)` in a Vitest setup file, returning an in-memory store (a plain `Map<string, object[]>`) so SQL calls can be intercepted.

**Rationale**: The plugin exports a `Database` class whose `load()` static returns a DB instance. Mocking at the module boundary means production code is unchanged and tests exercise the full `SqliteDatabase` class. A simple in-memory store is sufficient to verify that the right SQL strings and params are passed.

**Alternative considered**: Inject a fake `Database` via constructor — would require modifying `SqliteDatabase` to accept an injected dep, changing production code for the sake of tests. Rejected.

**Alternative considered**: Use an in-process SQLite (e.g., `better-sqlite3`) — possible but adds a native dependency and couples tests to real SQL semantics when we only need to verify the db module's own logic.

### 3. Test file layout

**Decision**: Place tests under `src/lib/db/__tests__/` with one file per module (`query-builder.test.ts`, `sqlite.test.ts`, `settings.test.ts`, `repositories/*.test.ts`).

**Rationale**: Co-location with the source makes it obvious which tests cover which file. Separate `__tests__` subdirectory keeps the source directory clean.

### 4. Vitest config inline in `vite.config.ts`

**Decision**: Add a `test` block to the existing `vite.config.ts` rather than a separate `vitest.config.ts`.

**Rationale**: Single config file, inherits the `resolve.alias` (`@/`) automatically. Adding a second config file would require duplicating the alias.

## Risks / Trade-offs

- **Mock drift**: If the real plugin's API changes, the mock may silently diverge. Mitigation: keep the mock minimal and typed against the plugin's exported interface.
- **No real SQL execution**: Tests verify that the correct SQL strings are generated and passed, but not that they work against SQLite. Mitigation: this is acceptable — the plugin's own tests cover SQL correctness; ours cover the db module's logic.
- **`vite.config.ts` becomes a mixed-purpose file**: Adding `test` config here is idiomatic for Vitest but may surprise contributors. Mitigation: add a comment.

## Open Questions

- None blocking. Coverage thresholds and CI integration can be decided separately.
