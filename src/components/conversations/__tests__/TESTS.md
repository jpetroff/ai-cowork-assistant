# Tests

## Running tests

```bash
# Run all tests once
bun run vitest run

# Watch mode during development
bun run vitest

# Run a specific file
bun run vitest run src/components/conversations/__tests__/conversationStore.test.ts

# Run tests matching a name pattern
bun run vitest run --reporter=verbose -t "loadForProject"
```

All tests use [Vitest](https://vitest.dev). No additional setup is needed — the test runner handles mocking and environment selection automatically.

---

## What is tested

### Repository layer — `src/lib/db/__tests__/repositories/`

Pure SQL-layer tests. Each test inspects the SQL string and bound parameters that were passed to the database driver, without touching a real SQLite file.

| File                    | What it covers                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `artifacts.test.ts`     | `createArtifact` (null defaults, UUID), `updateArtifact` (dynamic SET clause, no-op on empty), `listArtifactsByProject` (JOIN through conversations, ORDER BY, LIMIT) |
| `conversations.test.ts` | `createConversation`, `listConversations` (WHERE clause), `updateConversation`                                                                                        |
| `projects.test.ts`      | `createProject`, `listProjects`, `updateProject`                                                                                                                      |
| `messages.test.ts`      | `createMessage`, `listMessages`                                                                                                                                       |
| `llm-providers.test.ts` | `createLlmProvider`, `setDefaultProvider`                                                                                                                             |

Also: `settings.test.ts` covers `getSetting`/`setSetting` upsert behavior, and `sqlite.test.ts` covers the `QueryBuilder` fluent API.

### Store layer — colocated `__tests__/`

Unit tests for Zustand store actions. Repositories are mocked with `vi.mock`; tests assert store state transitions, error handling, and `notificationStore` integration.

| File                           | Actions covered                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `projectStore.test.ts`         | `loadAll`, `create`, `rename`, `delete`, `update` (folder path)                                                                       |
| `conversationStore.test.ts`    | `loadForProject`, `create`, `rename`, `delete`, `setActive`                                                                           |
| `projectSettingsStore.test.ts` | `loadAiConfig` (valid JSON, missing key, invalid JSON, DB error), `saveAiConfig` (optimistic update, persistence, failure resilience) |
| `llmProviderStore.test.ts`     | `loadAll`, `fetchModels` (caching, non-OK response, network failure, auth header, keyless provider)                                   |
| `notificationStore.test.ts`    | `push`, `dismiss`, `dismissAll`, auto-dismiss timer                                                                                   |

Key patterns tested across stores:

- **DB-first writes**: `operationStates[id]` is set to `'renaming'`/`'deleting'` during the write and cleared on both success and failure.
- **Concurrent operation guard**: a second call for the same ID while an operation is in flight is a no-op.
- **Error paths**: DB failures clear operation state and push an error notification to `notificationStore`.

### Component layer — `src/components/**/__tests__/`

Integration tests that render components in a jsdom environment and drive them with real user events via `@testing-library/user-event`. Tauri plugins and React Router are mocked; Zustand stores are real (pre-seeded with `setState`).

| File                                     | What it covers                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projects/ProjectHeader.test.tsx`        | Back link href, click-to-edit rename, Enter/Escape/✓/× all apply or discard correctly                                                             |
| `projects/ProjectCard.test.tsx`          | Name display, navigation on click, `aria-busy` in deleting/renaming states, delete confirmation flow                                              |
| `projects/RenameProjectForm.test.tsx`    | Pre-fill, submit with trimmed name, unchanged-name no-op, disabled state during rename                                                            |
| `projects/AiConfigCard.test.tsx`         | No-providers state (3 disabled selects + Configure CTA), with-providers state (CTA absent), saved config reflected                                |
| `conversations/ConversationRow.test.tsx` | Title display, "Untitled" fallback, timestamp, navigation on click, delete confirmation, `pointer-events-none` when busy                          |
| `conversations/NewTaskInput.test.tsx`    | Placeholder text, disabled Send on empty/whitespace, enabled on input, Send click submits, Enter inserts newline, Ctrl+Enter submits, empty guard |
| `ui/NotificationToast.test.tsx`          | Renders notifications, close button, details dialog, clipboard copy                                                                               |

> **Note on dropdown menus**: interactions that require opening a floating popup (DropdownMenu, Select content) are not fully tested in jsdom because Base UI's positioning logic depends on layout measurements unavailable there. These flows are covered by Playwright E2E tests (not yet written). Unit tests verify the trigger renders, the busy state, and the resulting store calls via direct `store.getState()` invocation.

---

## How to add a test

### Adding a repository test

1. Open (or create) `src/lib/db/__tests__/repositories/<entity>.test.ts`.
2. Import the function under test and the mock helpers from the shared setup:

```ts
import { describe, it, expect } from 'vitest'
import { mockDb, mockDatabaseInstance } from '../setup'
import { myNewFunction } from '../../repositories/my-entity'
```

3. For `execute`-based functions (INSERT, UPDATE, DELETE): call the function, then inspect `mockDb.rows[0].sql` and `mockDb.rows[0].params`.
4. For `select`-based functions: call `mockDb.queueResult(yourData)` before the function, then inspect `mockDatabaseInstance.select.mock.calls[0]`.

```ts
it('filters by project_id', async () => {
  mockDb.queueResult([])
  await listThings('proj-1')
  const [sql, params] = mockDatabaseInstance.select.mock.calls[0]
  expect(sql).toContain('WHERE project_id = $1')
  expect(params).toEqual(['proj-1'])
})
```

### Adding a store test

1. Create `<feature-folder>/__tests__/<storeName>.test.ts`.
2. Mock all repository imports **before** importing the store:

```ts
const mockCreate = vi.fn()
vi.mock('@/lib/db/repositories/my-entity', () => ({
  createThing: (...args: unknown[]) => mockCreate(...args),
}))
// also mock plugin-sql to satisfy the db module:
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

import { useMyStore } from '../myStore'
```

3. Reset store state in `beforeEach` using `useMyStore.setState({...})`.
4. Call store actions via `useMyStore.getState().myAction(...)` and assert with `useMyStore.getState().someField`.

### Adding a component test

1. Create `src/components/<area>/__tests__/<ComponentName>.test.tsx`.
2. Add `// @vitest-environment jsdom` as the very first line.
3. Mock `react-router-dom` and any Tauri plugins the component imports:

```ts
// @vitest-environment jsdom
import { vi } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))
```

4. Seed store state before rendering:

```ts
import { useMyStore } from '@/components/my-feature/myStore'
beforeEach(() => useMyStore.setState({ items: [], status: 'ready' }))
```

5. Render, interact, assert:

```ts
render(<MyComponent prop="value" />)
await userEvent.click(screen.getByRole('button', { name: /submit/i }))
expect(mockNavigate).toHaveBeenCalledWith('/expected-route')
```

---

## Test infrastructure

| File                              | Role                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/db/__tests__/setup.ts`   | Global setup for all tests. Creates an in-memory `mockDb` (captures SQL calls) and mocks `@tauri-apps/plugin-sql`. Resets between each test via `beforeEach`. |
| `src/test-setup.ts`               | Imports `@testing-library/jest-dom/vitest` to add DOM matchers (`toBeInTheDocument`, `toBeDisabled`, etc.) to all tests.                                      |
| `vite.config.ts` (`test` section) | Sets default environment to `node`, includes all `*.test.{ts,tsx}` files under `src/`, and registers both setup files.                                        |

The default test environment is **`node`** — fast and sufficient for store/repository tests. Component tests opt in to **`jsdom`** with the `// @vitest-environment jsdom` file-level comment, which activates a browser-like DOM for that file only.
