# DB Module Tests

Unit tests for `src/lib/db/` — runs entirely in Node via Vitest with a mocked `@tauri-apps/plugin-sql`. No Tauri process, no SQLite file, no native binaries required.

## Running

```bash
bun test                  # run all tests once
bun run test:watch        # watch mode
bunx vitest run --reporter=verbose   # verbose output
```

## Test files

| File | What it covers |
| --- | --- |
| [setup.ts](setup.ts) | Mock infrastructure (not a test file) |
| [query-builder.test.ts](query-builder.test.ts) | `QueryBuilder` SQL generation |
| [sqlite.test.ts](sqlite.test.ts) | `SqliteDatabase` CRUD methods |
| [settings.test.ts](settings.test.ts) | `getSetting` / `setSetting` |
| [repositories/projects.test.ts](repositories/projects.test.ts) | `createProject`, `listProjects`, `updateProject` |
| [repositories/conversations.test.ts](repositories/conversations.test.ts) | `createConversation`, `listConversations`, `updateConversation` |
| [repositories/messages.test.ts](repositories/messages.test.ts) | `createMessage`, `listMessages` |
| [repositories/artifacts.test.ts](repositories/artifacts.test.ts) | `createArtifact`, `updateArtifact` |
| [repositories/llm-providers.test.ts](repositories/llm-providers.test.ts) | `createLlmProvider`, `setDefaultProvider` |

## How the mock works

`setup.ts` intercepts `@tauri-apps/plugin-sql` via `vi.mock` before any test file imports it. It returns a fake `Database` instance backed by two in-memory structures:

- **`mockDb.rows`** — an array of `{ sql, params }` objects recorded by every `execute()` call. Use this to assert INSERT / UPDATE / DELETE statements.
- **`mockDatabaseInstance.select.mock.calls`** — Vitest spy call records for every `select()` call. Use this to assert SELECT statements (e.g. `listProjects`, `listMessages`).

The mock resets automatically between every test via `beforeEach`.

### Queuing select results

Because `select()` needs to return data, use `mockDb.queueResult()` before calling the function under test:

```typescript
mockDb.queueResult([{ id: 'p1', name: 'My Project', ... }])
const project = await getProject('p1')
```

Results are consumed in FIFO order. If no result is queued, `select()` returns `[]`.

### Asserting execute() calls (INSERT / UPDATE / DELETE)

```typescript
await createProject({ name: 'X', folder_path: '/x' })

const { sql, params } = mockDb.rows[0]
expect(sql).toContain('INSERT INTO projects')
expect(params).toContain('X')
```

### Asserting select() calls

```typescript
mockDb.queueResult([])
await listProjects()

const [sql] = mockDatabaseInstance.select.mock.calls[0]
expect(sql).toContain('ORDER BY updated_at DESC')
```

### Simulating plugin errors

```typescript
import { mockDatabaseInstance } from './setup'

mockDatabaseInstance.execute.mockRejectedValueOnce(new Error('disk full'))
await expect(createProject({ name: 'X', folder_path: '/x' })).rejects.toBeInstanceOf(DatabaseError)
```

## Adding new tests

1. Import `mockDb` (and `mockDatabaseInstance` if you need to inspect selects) from `./setup`
2. Queue any `select()` return values with `mockDb.queueResult()` before calling the function
3. After the call, check `mockDb.rows` for execute calls or `mockDatabaseInstance.select.mock.calls` for select calls
4. No cleanup needed — state resets between tests automatically

When adding a new repository module, add a corresponding test file under `repositories/` following the existing pattern.
