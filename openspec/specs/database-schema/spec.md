# Spec: Database Schema

## Requirements

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
The system SHALL create a `projects` table with UUID primary key, nullable folder path, and timestamps (Unix ms). The `name` column SHALL NOT have a UNIQUE constraint — duplicate names are permitted. These properties are defined in the single initial migration (v1) in `db.rs`; no incremental migration is required.

#### Scenario: Folder path may be null

- **WHEN** a project is inserted with no folder path
- **THEN** the row is stored successfully with `folder_path` as NULL

#### Scenario: Duplicate names are permitted

- **WHEN** two projects with the same name are inserted
- **THEN** both inserts succeed without error

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

### Requirement: Prisma schema acts as TypeScript-side peer to the Rust migration

The system SHALL maintain `prisma/schema.prisma` as the TypeScript-side peer definition of the schema defined in `src-tauri/src/db.rs`. A comment header in each file SHALL reference the other file as the peer definition, establishing a documented parity contract.

#### Scenario: Cross-reference comments present

- **WHEN** a developer opens `prisma/schema.prisma`
- **THEN** a comment at the top references `src-tauri/src/db.rs` as the Rust peer

#### Scenario: Cross-reference comments present in Rust

- **WHEN** a developer opens `src-tauri/src/db.rs`
- **THEN** a comment references `prisma/schema.prisma` as the TypeScript peer

### Requirement: prisma generate is integrated into the build workflow

The system SHALL invoke `prisma generate` as part of the frontend build and dev scripts so that TypeScript types are always up to date before compilation.

#### Scenario: Types generated on dev start

- **WHEN** the developer runs `npm run dev` (or equivalent)
- **THEN** `prisma generate` runs and produces updated types before Vite starts

#### Scenario: Types generated on production build

- **WHEN** `npm run build` is executed
- **THEN** `prisma generate` runs before TypeScript compilation

---

### Requirement: Artifact repository supports project-scoped queries
The system SHALL provide a `listArtifactsByProject(projectId, limit?)` function in the artifacts repository that retrieves artifacts belonging to any conversation within the given project. The query SHALL JOIN `artifacts` through `conversations` on `project_id`, ordering results by `artifacts.updated_at` DESC. An optional `limit` parameter restricts the result count.

#### Scenario: Returns artifacts across all conversations in a project

- **WHEN** `listArtifactsByProject(projectId)` is called for a project with conversations that each have artifacts
- **THEN** all artifacts from all conversations in that project are returned, ordered by `updated_at` DESC

#### Scenario: Limit parameter restricts result count

- **WHEN** `listArtifactsByProject(projectId, 3)` is called for a project with more than 3 artifacts
- **THEN** exactly 3 artifacts are returned (the 3 most recently updated)

#### Scenario: Returns empty array for project with no artifacts

- **WHEN** `listArtifactsByProject(projectId)` is called for a project with no artifacts
- **THEN** an empty array is returned without error
