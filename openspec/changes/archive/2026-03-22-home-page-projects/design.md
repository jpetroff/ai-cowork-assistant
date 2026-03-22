## Context

The app's home page currently renders `ProjectListSkeleton` unconditionally — there is no real data, no store, and no route loader wired up. The DB layer (`listProjects`, `createProject`, `updateProject`, `deleteProject`) is fully implemented in `src/lib/db/repositories/projects.ts`. The Zustand stub in `stubs.ts` exports `useProjectStore` returning `{ status: 'loading' }` permanently.

The codebase follows a strict discipline: **no data fetching in components** — all side effects go through store actions, triggered by React Router v7 route loaders. The `AppShell` owns persistent UI that must survive route transitions (routing progress bar already there). Components are split into dumb presentation and store-connected containers.

The SQLite schema has `folder_path TEXT NOT NULL` on the `projects` table. This must change; the column is not used during creation and is irrelevant to home page functionality.

## Goals / Non-Goals

**Goals:**
- Functional home page: lists all projects, create/rename/delete with correct UX states
- `projectStore` as the authoritative Zustand store for project list state
- `notificationStore` as the global error/messaging bus — no other mechanism
- DB-first writes with visible per-card operation states; full recovery on failure
- Single merged migration (v1) with `folder_path` nullable and no UNIQUE on `name`
- Folder interactions entirely absent from this change

**Non-Goals:**
- Folder assignment or reassignment (project page concern)
- `checkFolderAccess` or `folderAccessErrors` (project/chat page concern)
- LLM-based auto-naming of projects (deferred)
- Name uniqueness enforcement
- Conversation or artifact loading
- Any sidecar or AI interaction

## Decisions

### 1. Route loader as store trigger (not data source)

The index route loader calls `await projectStore.getState().loadAll()` and returns `null`. Components read exclusively from the Zustand store via `useProjectStore`. `useLoaderData()` is not used.

**Why over returning data from loader:** Zustand is the single source of truth per the spec's architecture. Mixing `useLoaderData` and store state creates two sources that can diverge. For a local-only desktop app, the loader-as-trigger pattern is correct and simpler.

### 2. Per-item operation states in the store (not component-local)

`operationStates: Record<string, 'renaming' | 'deleting'>` lives in `projectStore`, not in component `useState`. Store actions set and clear these atomically around DB calls.

**Why:** Store actions own the DB calls. The state describing those calls must live alongside them. Component-local state would require drilling callbacks or additional synchronization. The store is the right owner.

### 3. Error surfacing via `notificationStore` only — cards fully recover

On DB failure, the card returns to idle state and a toast fires via `notificationStore`. There is no per-card persistent error state.

**Why:** Per-card error states require the user to interact with the card to dismiss. Toasts are the established, expected pattern for transient action errors. Cards represent entities — their visual state should reflect entity state, not operation history. Mixing operation failure into entity state is a category error.

**Toast anatomy:** brief message + `[details]` pseudo-link → dialog with full error text + copy button + manual close (`✕`). No auto-dismiss for errors.

### 4. `notificationStore` is completely independent

The notification store has no imports from any other store. Other stores call `notificationStore.getState().push(...)` as a side-effecting call. The toast UI component mounts in `AppShell` and reads the store directly.

**Why:** Any future store or async background operation needs to be able to push notifications without creating circular dependencies.

### 5. `create()` creates immediately — no form

Clicking "New Project" calls `projectStore.create()` directly. No modal, no form input. The project is created with the name `"New project"` and the user is navigated to `/projects/:id` where they can rename it. Form entry before creation is deferred until LLM auto-naming is implemented.

**Why:** Requiring a name upfront is unnecessary friction given that the name is temporary. This matches the UX pattern of all modern LLM chat tools (new chat → immediate creation → auto-title later).

### 6. Rename via a minimal modal form

Rename is the only home-page action that requires user input. A small dialog (shadcn `Dialog`) with a single pre-filled name input. Submit is the only interaction. No folder field, no other settings.

### 7. Single merged migration — no incremental migrations in development

The correct `folder_path TEXT` (nullable) and no UNIQUE constraint on `name` are written directly into the initial migration v1 in `db.rs`. No migration v2. Development assumes a clean DB state; the existing DB file is deleted when the schema changes.

**Why:** Incremental migration logic (table rebuild, copy, drop) is operational complexity that only pays off when live data must be preserved across upgrades. In development with no production data, merging schema changes into the single migration is simpler, safer, and produces cleaner code. A migration strategy will be introduced when the app reaches a pre-release state with real user data to protect.

### 8. `stubs.ts` updated, not deleted

The `stubs.ts` file exports stubs for `useConversationStore`, `useMessageStore`, and `useArtifactStore` in addition to `useProjectStore`. Only the project stub is replaced; the file and the remaining stubs stay until those stores are implemented.

## Risks / Trade-offs

**Concurrent deletes on slow DB** → Two rapid deletes could both set `operationStates[id]`; the second would overwrite the first's cleanup. Mitigation: guard in `delete()` — if `operationStates[id]` is already set, ignore the second call.

**`notificationStore` notifications accumulate** → If many background errors fire without user dismissal, the toast stack grows. Mitigation: cap stack at 5 visible; older ones scroll off but remain dismissable.
