## ADDED Requirements

### Requirement: Database initializes on startup
The system SHALL expose a `run_migrations` Tauri command that creates all required tables and indices in the SQLite database (`app_data.db`) using `CREATE TABLE IF NOT EXISTS` statements, making the operation safe to call on every startup.

#### Scenario: First launch creates all tables
- **WHEN** `run_migrations` is invoked on a fresh database
- **THEN** all six tables exist: `projects`, `conversations`, `messages`, `artifacts`, `llm_providers`, `app_settings`

#### Scenario: Subsequent launches are idempotent
- **WHEN** `run_migrations` is invoked on a database that already has all tables
- **THEN** the command succeeds without error and no data is lost

### Requirement: WAL mode and foreign keys are enabled
The system SHALL enable WAL journal mode and foreign key enforcement via PRAGMA statements at the start of every migration run.

#### Scenario: WAL mode active
- **WHEN** `run_migrations` completes
- **THEN** `PRAGMA journal_mode` returns `wal`

#### Scenario: Foreign key enforcement active
- **WHEN** `run_migrations` completes
- **THEN** `PRAGMA foreign_keys` returns `1`

### Requirement: Projects table stores project records
The system SHALL create a `projects` table with UUID primary key, unique name, folder path, and timestamps (Unix ms).

#### Scenario: Unique name constraint enforced
- **WHEN** two projects with the same name are inserted
- **THEN** the second insert fails with a UNIQUE constraint error

### Requirement: Conversations table is indexed by project
The system SHALL create a `conversations` table with a foreign key to `projects(id) ON DELETE CASCADE` and an index on `(project_id, updated_at DESC)`.

#### Scenario: Cascade delete removes conversations
- **WHEN** a project is deleted
- **THEN** all associated conversations are automatically deleted

### Requirement: Messages table enforces ordered uniqueness per conversation
The system SHALL create a `messages` table with a composite UNIQUE constraint on `(conversation_id, sequence_order)` and an index on the same columns.

#### Scenario: Duplicate sequence order rejected
- **WHEN** two messages with the same `conversation_id` and `sequence_order` are inserted
- **THEN** the second insert fails with a UNIQUE constraint error

### Requirement: Artifacts table links to conversations and messages
The system SHALL create an `artifacts` table with a foreign key to `conversations(id) ON DELETE CASCADE` and an optional foreign key to `messages(id) ON DELETE SET NULL`.

#### Scenario: Artifact survives message deletion
- **WHEN** the associated message is deleted
- **THEN** the artifact's `message_id` is set to NULL and the artifact is not deleted

### Requirement: Default app settings are seeded
The system SHALL insert default values for `theme`, `approval_mode`, and `editor_autosave_interval_ms` into `app_settings` using `INSERT OR IGNORE` so existing values are not overwritten.

#### Scenario: Defaults present after first migration
- **WHEN** `run_migrations` runs on an empty database
- **THEN** `app_settings` contains rows for `theme`, `approval_mode`, and `editor_autosave_interval_ms`

#### Scenario: User settings not overwritten on restart
- **WHEN** a user has changed `theme` and the app restarts (running `run_migrations` again)
- **THEN** the `theme` value in `app_settings` reflects the user's change, not the default
