## MODIFIED Requirements

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

---

### Requirement: Conversations table tracks the active artifact
The system SHALL add an `active_artifact_id TEXT` column to the `conversations` table. This is a soft reference with no FK constraint (avoids circular dependency with `artifacts.conversation_id`). It SHALL be nullable.

#### Scenario: New conversation has no active artifact
- **WHEN** a conversation is inserted
- **THEN** `active_artifact_id` is null

#### Scenario: Active artifact is persisted
- **WHEN** `active_artifact_id` is set on a conversation row
- **THEN** the value persists across app restarts and is retrievable via the conversations repository

---

## ADDED Requirements

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
