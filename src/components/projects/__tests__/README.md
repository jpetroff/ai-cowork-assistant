# Component Tests: `src/components/projects`

Component-level tests for the project management UI. These tests run in a simulated browser environment (jsdom) and focus on rendering correctness, user interaction, and integration with Zustand stores.

## What's Covered

### `ProjectCard.test.tsx`

Tests the `ProjectCard` component — the tile shown on the home page for each project.

| Suite | What it tests |
|---|---|
| **Idle state** | Name and date render correctly; clicking the card navigates to `/projects/:id` |
| **Deleting state** | `operationStates[id] = 'deleting'` → card gets `aria-busy=true` and `pointer-events-none` |
| **Renaming state** | `operationStates[id] = 'renaming'` → card gets `aria-busy=true` |
| **Options menu trigger** | The `⋯` button is rendered and accessible; disappears as interactive when card is busy |
| **Delete confirmation** | Confirming the delete dialog calls `projectStore.delete(id)` |

**Not tested here (E2E):** Opening the dropdown menu and clicking "Delete" or "Rename" — Base UI's `Menu` popup uses a floating portal that doesn't render in jsdom. These flows are covered by Playwright E2E tests.

---

### `RenameProjectForm.test.tsx`

Tests the `RenameProjectForm` modal — a single-input dialog for renaming a project.

| Test | What it tests |
|---|---|
| Pre-filled input | Input shows the current project name when the dialog opens |
| Empty name disables submit | Submit button is `disabled` when the name field is cleared |
| Trimmed name on submit | Leading/trailing whitespace is stripped before calling `projectStore.rename()` |
| Disabled during operation | Input and submit button are disabled while `operationStates[id] = 'renaming'` |
| No-op on unchanged name | If the name hasn't changed, no DB call is made and the dialog closes |

---

## Running the Tests

```bash
# Run all tests once
bun run test

# Run only this directory
bun run test -- src/components/projects/__tests__

# Watch mode
bun run test:watch
```

---

## Libraries Used

| Library | Purpose |
|---|---|
| [Vitest](https://vitest.dev) | Test runner and assertion framework |
| [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro) | Renders components and queries the DOM by accessible role/label/text |
| [@testing-library/user-event](https://testing-library.com/docs/user-event/intro) | Simulates real user interactions (type, click, clear) |
| [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | Adds DOM-aware matchers: `toBeDisabled()`, `toBeInTheDocument()`, etc. |

All test files declare `// @vitest-environment jsdom` at the top, which switches them from the default `node` environment to a DOM environment per-file.

---

## How to Add a New Test

### For a new component

1. Create `__tests__/MyComponent.test.tsx` alongside this file.
2. Add `// @vitest-environment jsdom` as the first line.
3. Follow this structure:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MyComponent } from '../MyComponent'

// Mock Tauri SQL (required if any store is imported)
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

// Mock DB repositories (replace real DB calls with controllable fns)
const mockSomeRepo = vi.fn()
vi.mock('@/lib/db/repositories/something', () => ({
  someRepo: (...args: unknown[]) => mockSomeRepo(...args),
}))

afterEach(cleanup) // prevents DOM leaking between tests

beforeEach(() => {
  mockSomeRepo.mockReset()
  // reset any Zustand stores used by the component
})

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected text')).toBeInTheDocument()
  })
})
```

### Key rules

- **Always call `afterEach(cleanup)`** — without it, rendered components accumulate in the DOM across tests, causing "found multiple elements" errors.
- **Reset store state in `beforeEach`** — use `useMyStore.setState({ ... })` to put the store in a known state before each test.
- **Mock `@tauri-apps/plugin-sql`** — any component that imports a Zustand store backed by SQLite needs this mock, even if it doesn't use the DB directly.
- **Mock DB repositories, not the DB layer** — mock at `@/lib/db/repositories/...` level so tests control what the store "sees" from the DB.
- **Use `findBy*` for async rendering** — Base UI dialogs and some async store effects need `await screen.findByRole(...)` instead of `screen.getByRole(...)`.
- **Dropdown menus → prefer E2E** — Base UI `Menu` portals don't reliably open in jsdom. Test the business logic separately (store tests) and cover the full interaction in Playwright.
