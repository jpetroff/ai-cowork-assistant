# Tasks: home-page-projects

## 1. DB Schema & Types

- [x] 1.1 Update migration v1 in `src-tauri/src/db.rs` — change `folder_path TEXT NOT NULL` to `folder_path TEXT` and remove `UNIQUE` from `name`; delete local `app_data.db` to apply clean schema
- [x] 1.2 Update `Project` type in `src/lib/db/types.ts` — `folder_path: string | null`
- [x] 1.3 Update `createProject()` in `src/lib/db/repositories/projects.ts` — `folder_path` optional param, defaults to null
- [x] 1.4 Update `projects.test.ts` — add tests for null `folder_path` insert and duplicate name insert

## 2. Notification Store

- [x] 2.1 Create `src/stores/notificationStore.ts` — `Notification` type, `push` / `dismiss` / `dismissAll` actions
- [x] 2.2 Write `src/stores/__tests__/notificationStore.test.ts` — push, dismiss, dismissAll, autoDismissMs scheduling

## 3. Project Store

- [x] 3.1 Create `src/stores/projectStore.ts` — `ProjectState` with `projects`, `status`, `error`, `operationStates`; actions: `loadAll`, `create`, `rename`, `delete`, `setActive`
- [x] 3.2 Implement `loadAll()` — calls `listProjects()`, sets `status` through `loading` → `ready`, handles errors
- [x] 3.3 Implement `create()` — inserts `"New project"` with null `folder_path`, prepends to `projects`, calls `notificationStore` on error
- [x] 3.4 Implement `rename(id, name)` — sets `operationStates[id]='renaming'`, DB update, clears state on success/failure, toast on failure
- [x] 3.5 Implement `delete(id)` — guards concurrent calls, sets `operationStates[id]='deleting'`, DB delete, removes from list, recovers + toast on failure
- [x] 3.6 Remove `useProjectStore` stub from `src/stores/stubs.ts`
- [x] 3.7 Write `src/stores/__tests__/projectStore.test.ts` — all actions (loadAll, create, rename, delete), operationStates lifecycle, error paths

## 4. Notification UI

- [x] 4.1 Create `src/components/ui/NotificationToast.tsx` — toast stack reading `notificationStore`; max 5 visible; close button per toast; `[details]` pseudo-link for error kind
- [x] 4.2 Create error details dialog inside `NotificationToast` — full `detail` text, copy-to-clipboard button
- [x] 4.3 Mount `<NotificationToast />` in `src/components/layout/AppShell.tsx` as persistent overlay

## 5. Project Components

- [x] 5.1 Create `src/components/projects/ProjectCard.tsx` — name, formatted date; reads `operationStates[id]` for deleting/renaming visual states; dropdown menu with Rename and Delete actions; click navigates to `/projects/:id`
- [x] 5.2 Create `src/components/projects/RenameProjectForm.tsx` — Dialog with single pre-filled name input; calls `projectStore.rename()`; disabled during `operationStates[id]='renaming'`; closes on success
- [x] 5.3 Create `src/components/projects/ProjectList.tsx` — renders skeleton/error/empty/grid states from `useProjectStore`; "New Project" button calling `projectStore.create()` then `navigate`; owns `RenameProjectForm` open state

## 6. Home Page & Router Wiring

- [x] 6.1 Update index route loader in `src/router.tsx` — replace TODO comment with `await projectStore.getState().loadAll()`
- [x] 6.2 Update `src/pages/HomePage.tsx` — render `<ProjectList />` replacing `<ProjectListSkeleton />`

## 7. Component Tests

- [x] 7.1 Write `src/components/projects/__tests__/ProjectCard.test.tsx` — idle render, deleting state (faded/blocked), renaming state (dimmed), rename menu item opens form, delete menu item triggers confirmation then `projectStore.delete()`
- [x] 7.2 Write `src/components/projects/__tests__/RenameProjectForm.test.tsx` — pre-filled name, submit calls `projectStore.rename()`, disabled during operation, closes on success
- [x] 7.3 Write `src/components/ui/__tests__/NotificationToast.test.tsx` — renders notifications, close button calls dismiss, details dialog opens on `[details]` click, copy button writes to clipboard
