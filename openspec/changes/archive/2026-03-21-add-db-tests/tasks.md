# Tasks: add-db-tests

## 1. Tooling Setup

- [x] 1.1 Install `vitest` and `@vitest/ui` as dev dependencies via `bun add -D vitest @vitest/ui`
- [x] 1.2 Add `test` block to `vite.config.ts` (environment: `node`, include: `src/**/*.test.ts`)
- [x] 1.3 Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `package.json`
- [x] 1.4 Verify `bunx vitest run` exits with no errors on an empty test suite

## 2. Plugin Mock

- [x] 2.1 Create `src/lib/db/__tests__/setup.ts` that exports a `mockDb` in-memory store (Map of table → rows)
- [x] 2.2 Implement `vi.mock('@tauri-apps/plugin-sql', ...)` in the setup file — mock `Database.load()` to return an object with `select()` and `execute()` backed by the in-memory store
- [x] 2.3 Register the setup file in the vitest config (`setupFiles`)
- [x] 2.4 Add a helper to reset the in-memory store between tests (`beforeEach(() => mockDb.clear())`)

## 3. QueryBuilder Tests

- [x] 3.1 Create `src/lib/db/__tests__/query-builder.test.ts`
- [x] 3.2 Test: single `.filter('role', '=', 'user')` produces `WHERE role = ?` with correct binding
- [x] 3.3 Test: two `.filter()` calls produce `WHERE ... AND ...`
- [x] 3.4 Test: `.filter('id', 'IN', ['a','b','c'])` produces `id IN (?, ?, ?)` with all three bindings
- [x] 3.5 Test: `.orderBy('created_at', 'desc')` produces `ORDER BY created_at DESC`
- [x] 3.6 Test: `.limit(10).offset(20)` produces `LIMIT 10 OFFSET 20`
- [x] 3.7 Test: `.count()` generates `SELECT COUNT(*) as count FROM ...`
- [x] 3.8 Test: `.first()` applies `LIMIT 1` and returns the first element or null

## 4. SqliteDatabase Tests

- [x] 4.1 Create `src/lib/db/__tests__/sqlite.test.ts`
- [x] 4.2 Test: `db.get()` returns `null` when mock returns empty array
- [x] 4.3 Test: `db.get()` returns the row when mock returns one result
- [x] 4.4 Test: `db.insert()` calls execute with `id`, `created_at`, `updated_at` columns and returns a UUID string
- [x] 4.5 Test: `db.upsert()` calls UPDATE when record already exists (mock `get` returns a row)
- [x] 4.6 Test: `db.upsert()` calls INSERT when record does not exist (mock `get` returns null)
- [x] 4.7 Test: `db.remove()` executes `DELETE FROM <table> WHERE id = $1`
- [x] 4.8 Test: methods wrap plugin errors in `DatabaseError`

## 5. Settings Tests

- [x] 5.1 Create `src/lib/db/__tests__/settings.test.ts`
- [x] 5.2 Test: `getSetting('theme')` returns `null` when no row in `app_settings`
- [x] 5.3 Test: `getSetting('theme')` returns `'dark'` when row exists
- [x] 5.4 Test: `setSetting('theme', 'dark')` executes SQL containing `ON CONFLICT(key) DO UPDATE SET value`

## 6. Repository Tests

- [x] 6.1 Create `src/lib/db/__tests__/repositories/projects.test.ts`
- [x] 6.2 Test: `createProject()` executes INSERT into `projects` and returns a UUID
- [x] 6.3 Test: `listProjects()` SQL contains `ORDER BY updated_at DESC`
- [x] 6.4 Test: `updateProject(id, { name })` SQL sets `name` and `updated_at` only
- [x] 6.5 Create `src/lib/db/__tests__/repositories/conversations.test.ts`
- [x] 6.6 Test: `createConversation()` inserts with provided `project_id`
- [x] 6.7 Test: `listConversations(projectId)` SQL filters `WHERE project_id = $1`
- [x] 6.8 Test: `updateConversation()` sets `title` and `updated_at`
- [x] 6.9 Create `src/lib/db/__tests__/repositories/messages.test.ts`
- [x] 6.10 Test: `createMessage()` INSERT does NOT include `updated_at` column
- [x] 6.11 Test: `listMessages()` SQL orders by `sequence_order ASC`
- [x] 6.12 Create `src/lib/db/__tests__/repositories/artifacts.test.ts`
- [x] 6.13 Test: `createArtifact()` with minimal args inserts `null` for optional fields
- [x] 6.14 Test: `updateArtifact()` builds correct partial SET clause
- [x] 6.15 Create `src/lib/db/__tests__/repositories/llm-providers.test.ts`
- [x] 6.16 Test: `setDefaultProvider(id)` executes two statements — first clears all `is_default`, then sets it for the given id

## 7. Verify

- [x] 7.1 Run `bun test` and confirm all tests pass with no skips
- [x] 7.2 Confirm `bunx tsc --noEmit` still passes (no type errors introduced)
