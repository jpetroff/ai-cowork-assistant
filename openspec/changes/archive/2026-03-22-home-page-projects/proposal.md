## Why

The application has no functional home page. Currently it renders a skeleton placeholder with no real data. Users landing on the home screen after setup cannot see, create, or manage their projects. This is the first functional surface users interact with and must be built before any project-level work can begin.

## What Changes

- Implement `projectStore` (Zustand) replacing the current stub — handles project list loading, creation with default name, rename, and delete with DB-first operation states
- Add `notificationStore` (Zustand) as a global singleton for surfacing errors and background action results via a toast UI, accessible to all stores and components
- Build `ProjectList`, `ProjectCard`, and `RenameProjectForm` components backed by the store
- Wire the home page route loader to call `projectStore.loadAll()` before render
- Mount `NotificationToast` in `AppShell` so it persists across route transitions
- Make `folder_path` nullable in the SQLite schema (migration v2) and update types/repositories accordingly — folder assignment is a project-page concern, not a home-page concern
- Remove the `name` uniqueness constraint — projects default to "New project"; LLM-based auto-naming is deferred
- Per-card operation states (`renaming`, `deleting`) disable interaction and show progress during DB writes; on failure the card recovers fully and an error toast fires

## Capabilities

### New Capabilities
- `project-management`: CRUD operations for projects — list, create with default name, rename, delete. Includes per-item operation states, DB-first writes, and error recovery via notification store.
- `notification`: Global store and toast UI for surfacing errors, action results, and background operation status across the entire application.

### Modified Capabilities
- `project`: `folder_path` changes from required to optional — it is assigned at the project level, not during creation. Name uniqueness is no longer enforced.

## Impact

- **DB schema**: `folder_path TEXT NOT NULL` → `folder_path TEXT` (requires migration v2 with table rebuild)
- **TypeScript types**: `Project.folder_path: string` → `string | null`
- **Repository**: `createProject()` signature — `folder_path` becomes optional
- **Stores**: `stubs.ts` stub for `useProjectStore` removed; real store added; new `notificationStore` added
- **Router**: index loader `TODO` comment replaced with `projectStore.loadAll()` call
- **AppShell**: `NotificationToast` component mounted as a persistent overlay
- **Rust/Tauri**: No new commands needed for this change
