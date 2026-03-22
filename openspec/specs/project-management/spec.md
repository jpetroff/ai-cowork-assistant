# Spec: Project Management

## Requirements

### Requirement: Project store loads all projects on home page navigation
The system SHALL load all projects from SQLite into the Zustand `projectStore` when the home route loader runs, before any component renders. The loader calls `projectStore.getState().loadAll()` and returns `null`; components read exclusively from the store.

#### Scenario: Successful load

- **WHEN** the user navigates to the home route
- **THEN** the route loader calls `projectStore.loadAll()` and the store's `status` transitions from `'idle'` to `'loading'` then `'ready'`

#### Scenario: DB failure during load

- **WHEN** `loadAll()` encounters a DB error
- **THEN** the store's `status` is set to `'error'` with the error message captured

---

### Requirement: Home page renders project list based on store status
The system SHALL render the home page according to the `projectStore` status:
- `'loading'` → skeleton placeholder grid (3 ghost cards)
- `'error'` → error state with retry
- `projects.length === 0` (and `'ready'`) → empty state with "New Project" CTA
- `projects.length > 0` (and `'ready'`) → grid of project cards with "New Project" button

#### Scenario: Empty state shown when no projects exist

- **WHEN** `status` is `'ready'` and `projects` is empty
- **THEN** an empty state message and a prominent "New Project" call-to-action are displayed

#### Scenario: Project grid shown when projects exist

- **WHEN** `status` is `'ready'` and `projects` has entries
- **THEN** one card per project is rendered plus a "New Project" button

---

### Requirement: User can create a project with a single click
The system SHALL create a new project named `"New project"` immediately when the user clicks "New Project", with no form or confirmation required. After creation the user is navigated to the project's dedicated page.

#### Scenario: Successful creation

- **WHEN** user clicks "New Project"
- **THEN** a project named `"New project"` is inserted into SQLite, prepended to `store.projects`, and the router navigates to `/projects/:id`

#### Scenario: DB failure on create

- **WHEN** the DB insert fails
- **THEN** no project is added to the store and an error toast is pushed to `notificationStore`

---

### Requirement: User can rename a project
The system SHALL allow the user to rename a project via a modal form containing a single pre-filled name input. The rename is written to SQLite first; the store and UI update only after DB success.

#### Scenario: Rename succeeds

- **WHEN** user submits a new name in the rename form
- **THEN** `operationStates[id]` is set to `'renaming'` (card disabled), DB is updated, store entry is updated in place, `operationStates[id]` is cleared, and the form closes

#### Scenario: Rename fails at DB

- **WHEN** the DB update fails
- **THEN** `operationStates[id]` is cleared, the form re-enables with the original name, and an error toast fires

---

### Requirement: User can delete a project
The system SHALL allow the user to delete a project after confirmation. The delete is written to SQLite first; the card is removed from the UI only after DB success. No files on disk are affected.

#### Scenario: Delete succeeds

- **WHEN** user confirms deletion
- **THEN** `operationStates[id]` is set to `'deleting'` (card visually disabled), the DB row is deleted, and the project is removed from `store.projects`

#### Scenario: Delete fails at DB

- **WHEN** the DB delete fails
- **THEN** `operationStates[id]` is cleared (card fully recovers) and an error toast fires

#### Scenario: Filesystem untouched

- **WHEN** a project is deleted
- **THEN** no filesystem operations are performed

---

### Requirement: Per-card operation states disable interaction during DB writes
The system SHALL maintain an `operationStates: Record<string, 'renaming' | 'deleting'>` map in `projectStore`. While an operation is in progress for a given project ID, the corresponding card SHALL be visually disabled and non-interactive.

#### Scenario: Deleting card is faded and blocked

- **WHEN** `operationStates[id]` is `'deleting'`
- **THEN** the card is rendered with reduced opacity, a spinner indicator, and all interactive elements are disabled

#### Scenario: Renaming card is dimmed

- **WHEN** `operationStates[id]` is `'renaming'`
- **THEN** the card is rendered dimmed and non-interactive while the rename modal submit is in-flight

#### Scenario: Concurrent delete guard

- **WHEN** a delete is already in progress for a project ID
- **THEN** a second delete call for the same ID is ignored
