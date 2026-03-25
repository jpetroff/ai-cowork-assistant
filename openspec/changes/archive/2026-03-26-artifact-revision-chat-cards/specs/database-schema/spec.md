## MODIFIED Requirements

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
