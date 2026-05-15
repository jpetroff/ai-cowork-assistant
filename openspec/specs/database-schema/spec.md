# Spec: Database Schema

## Requirements

### Requirement: Database initializes on startup

The system SHALL expose a `run_migrations` Tauri command that creates all required tables and indices in the SQLite database (`app_data.db`) using `CREATE TABLE IF NOT EXISTS` statements, making the operation safe to call on every startup.

#### Scenario: First launch creates all tables

- **WHEN** `run_migrations` is invoked on a fresh database
- **THEN** all tables exist: `projects`, `conversations`, `messages`, `artifacts`, `artifact_revisions`, `llm_providers`, `app_settings`

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

### Requirement: Conversations table is indexed by project and tracks the active artifact

The system SHALL create a `conversations` table with a foreign key to `projects(id) ON DELETE CASCADE` and an index on `(project_id, updated_at DESC)`. The table SHALL include an `active_artifact_id TEXT` column as a soft reference (no FK constraint) to the active artifact. It SHALL be nullable.

#### Scenario: Cascade delete removes conversations

- **WHEN** a project is deleted
- **THEN** all associated conversations are automatically deleted

#### Scenario: New conversation has no active artifact

- **WHEN** a conversation is inserted
- **THEN** `active_artifact_id` is null

#### Scenario: Active artifact is persisted

- **WHEN** `active_artifact_id` is set on a conversation row
- **THEN** the value persists across app restarts and is retrievable via the conversations repository

### Requirement: Messages table enforces ordered uniqueness per conversation

The system SHALL create a `messages` table with a composite UNIQUE constraint on `(conversation_id, sequence_order)` and an index on the same columns. The `role` column SHALL support three values: `'user'`, `'assistant'`, and `'system'`. The table SHALL include a nullable `metadata` column of type `TEXT` for storing JSON metadata (used by system messages to carry revision identity).

#### Scenario: First launch creates messages table with updated schema

- **WHEN** `run_migrations` is invoked on a fresh database
- **THEN** the `messages` table exists with columns: `id`, `conversation_id`, `role`, `content`, `metadata`, `sequence_order`, `created_at`; `role` CHECK allows `'user'`, `'assistant'`, `'system'`; `metadata` is nullable

#### Scenario: System message can be inserted

- **WHEN** a message row is inserted with `role: 'system'` and a JSON `metadata` value
- **THEN** the insert succeeds and the row is retrievable with the correct metadata

#### Scenario: User and assistant messages have null metadata

- **WHEN** a `role: 'user'` or `role: 'assistant'` message is inserted without metadata
- **THEN** `metadata` is stored as NULL and no error occurs

#### Scenario: v2 migration preserves existing messages

- **WHEN** the v2 migration runs on a database that already has `role: 'user'` and `role: 'assistant'` messages
- **THEN** all existing message rows are preserved with `metadata` set to NULL

#### Scenario: v2 migration backfills system messages for existing sealed revisions

- **WHEN** the v2 migration runs on a database with existing sealed revisions (`message_id IS NOT NULL` pointing to user/assistant messages)
- **THEN** a `role: 'system'` message is created for each sealed revision, `revision.message_id` is updated to point to the new system message, and the original user/assistant message link is removed from the revision

#### Scenario: Duplicate sequence order rejected

- **WHEN** two messages with the same `conversation_id` and `sequence_order` are inserted
- **THEN** the second insert fails with a UNIQUE constraint error

### Requirement: Artifacts table stores metadata only, with a pointer to the current revision

The system SHALL maintain an `artifacts` table with no `content`, `version`, `last_author`, or `message_id` columns. Instead it SHALL have a nullable `current_revision_id` TEXT column that is a soft reference (no FK constraint) to the HEAD row in `artifact_revisions`. The table SHALL retain `id`, `conversation_id`, `title`, `file_path`, `file_hash`, `created_at`, and `updated_at`.

#### Scenario: Artifact row contains no content

- **WHEN** a new artifact is inserted
- **THEN** the row has no `content` column and `current_revision_id` is null until the first revision is created

#### Scenario: current_revision_id is updated when HEAD changes

- **WHEN** a new revision becomes HEAD
- **THEN** `artifacts.current_revision_id` is updated to that revision's id

#### Scenario: Artifact survives revision deletion gracefully

- **WHEN** all revisions for an artifact are deleted (via cascade from artifact delete)
- **THEN** the artifact row itself is also deleted (ON DELETE CASCADE from conversation)

### Requirement: Default app settings are seeded

The system SHALL insert default values for `theme`, `approval_mode`, and `editor_autosave_interval_ms` into `app_settings` using `INSERT OR IGNORE` so existing values are not overwritten.

#### Scenario: Defaults present after first migration

- **WHEN** `run_migrations` runs on an empty database
- **THEN** `app_settings` contains rows for `theme`, `approval_mode`, and `editor_autosave_interval_ms`

#### Scenario: User settings not overwritten on restart

- **WHEN** a user has changed `theme` and the app restarts (running `run_migrations` again)
- **THEN** the `theme` value in `app_settings` reflects the user's change, not the default

### Requirement: Shared SQLite schema drives Rust migration and TypeScript types

The system SHALL maintain the database schema in `src-tauri/migrations/001_initial.sql`. The Rust migration SHALL include that SQL file, and TypeScript database row types SHALL be generated from that same SQL file.

#### Scenario: Rust migration includes shared SQL

- **WHEN** the Tauri SQL plugin registers migrations
- **THEN** it uses the SQL from `src-tauri/migrations/001_initial.sql`

#### Scenario: Generated TypeScript types match shared SQL

- **WHEN** `bun run db:generate` is executed
- **THEN** TypeScript database row types are generated from `src-tauri/migrations/001_initial.sql`

### Requirement: SQLite type generation is available in the build workflow

The system SHALL provide commands to generate and check TypeScript database row types from the shared SQLite schema.

#### Scenario: Types generated on demand

- **WHEN** `bun run db:generate` is executed
- **THEN** generated database row types are written before compilation

#### Scenario: Stale generated types are detected

- **WHEN** `bun run db:check` is executed
- **THEN** the command fails if generated database row types differ from the shared SQLite schema

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

---

### Requirement: artifact_revisions table stores all artifact content

The system SHALL create an `artifact_revisions` table with the following columns: `id TEXT PRIMARY KEY`, `artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE`, `message_id TEXT REFERENCES messages(id) ON DELETE SET NULL`, `author TEXT NOT NULL CHECK (author IN ('user', 'ai'))`, `content TEXT NOT NULL DEFAULT ''`, `created_at INTEGER NOT NULL`, `updated_at INTEGER NOT NULL`.

#### Scenario: Revision is deleted when its artifact is deleted

- **WHEN** an artifact is deleted
- **THEN** all associated `artifact_revisions` rows are automatically deleted via ON DELETE CASCADE

#### Scenario: Revision message_id is nulled when message is deleted

- **WHEN** the linked message is deleted
- **THEN** `artifact_revisions.message_id` is set to NULL and the revision row is retained

#### Scenario: author column rejects invalid values

- **WHEN** an insert is attempted with `author` not in `('user', 'ai')`
- **THEN** the insert fails with a CHECK constraint error

---

### Requirement: artifact_revisions has indices for efficient lookup

The system SHALL create an index on `(artifact_id, created_at DESC)` for history queries and a partial index on `message_id WHERE message_id IS NOT NULL` for chat thread rendering.

#### Scenario: History query uses artifact index

- **WHEN** all revisions for an artifact are queried ordered by `created_at DESC`
- **THEN** the query uses `idx_rev_artifact` and does not perform a full table scan

#### Scenario: Thread query uses partial message index

- **WHEN** revisions linked to a set of message IDs are queried for thread display
- **THEN** the query uses `idx_rev_message` and only scans rows where `message_id IS NOT NULL`

---

### Requirement: TypeScript types reflect the new schema

The system SHALL update `src/lib/db/types.ts` to: remove the `Artifact` interface's `content`, `version`, `last_author`, and `message_id` fields; add `current_revision_id: string | null`; add a new `ArtifactRevision` interface matching the `artifact_revisions` columns; add `'artifact_revisions'` to the `TableName` union.

#### Scenario: ArtifactRevision interface matches schema

- **WHEN** a row is selected from `artifact_revisions` and cast to `ArtifactRevision`
- **THEN** all fields (`id`, `artifact_id`, `message_id`, `author`, `content`, `created_at`, `updated_at`) are present with correct types

#### Scenario: Artifact interface has no content field

- **WHEN** TypeScript compiles code that accesses `artifact.content`
- **THEN** a type error is produced

---

### Requirement: artifacts repository is split into documents and revisions modules

The system SHALL replace `src/lib/db/repositories/artifacts.ts` with two modules: `documents.ts` (artifact metadata CRUD: create, get, list, update title/file_path/file_hash/current_revision_id, delete) and `revisions.ts` (revision CRUD: createRevision, getRevision, getHeadRevision, listRevisions, updateRevisionContent, sealRevision).

#### Scenario: createRevision inserts a new revision and updates artifact HEAD

- **WHEN** `createRevision({ artifactId, author, content, messageId? })` is called
- **THEN** a new row is inserted in `artifact_revisions` and `artifacts.current_revision_id` is updated to the new revision id in the same logical operation

#### Scenario: getHeadRevision returns current HEAD content

- **WHEN** `getHeadRevision(artifactId)` is called
- **THEN** it returns the revision row matching `artifact.current_revision_id`, or null if none exists

#### Scenario: updateRevisionContent updates only the HEAD revision

- **WHEN** `updateRevisionContent(revisionId, content)` is called
- **THEN** `artifact_revisions.content` and `updated_at` are updated for that row only

#### Scenario: sealRevision sets message_id on an existing revision

- **WHEN** `sealRevision(revisionId, messageId)` is called
- **THEN** `artifact_revisions.message_id` is set to the provided message id

#### Scenario: listRevisions returns all revisions for an artifact ordered by created_at DESC

- **WHEN** `listRevisions(artifactId)` is called
- **THEN** all revisions for that artifact are returned, most recent first
