# Spec: TypeScript DB API

## Requirements

### Requirement: TableName union covers all schema tables

The system SHALL define a `TableName` TypeScript union type that exactly matches the seven tables in the SQLite schema: `projects`, `conversations`, `messages`, `artifacts`, `artifact_revisions`, `llm_providers`, `app_settings`.

#### Scenario: All schema tables are representable

- **WHEN** a developer writes `const t: TableName = 'conversations'`
- **THEN** TypeScript accepts it without error

#### Scenario: Old table names are rejected

- **WHEN** a developer writes `const t: TableName = 'chats'`
- **THEN** TypeScript emits a type error

### Requirement: SQLite schema generates TypeScript DB row types

The system SHALL generate TypeScript database row types from `src-tauri/migrations/001_initial.sql` so the frontend API matches the SQLite migration used by Tauri.

#### Scenario: All models present

- **WHEN** `bun run db:generate` is executed
- **THEN** the generated schema types export `Project`, `Conversation`, `Message`, `Artifact`, `ArtifactRevision`, `LlmProvider`, `AppSetting`

#### Scenario: Column names match the database

- **WHEN** a `Project` type is used
- **THEN** it has fields `id`, `name`, `folder_path`, `created_at`, `updated_at` with correct TypeScript types

### Requirement: Typed repository for Projects

The system SHALL provide a `projects` repository module with typed functions: `createProject`, `getProject`, `listProjects`, `updateProject`, `deleteProject`.

#### Scenario: Create project returns ID

- **WHEN** `createProject({ name, folder_path })` is called
- **THEN** it returns a UUID string and the record is persisted

#### Scenario: Duplicate name rejected

- **WHEN** `createProject` is called with a name that already exists
- **THEN** it throws a `DatabaseError`

### Requirement: Typed repository for Conversations

The system SHALL provide a `conversations` repository module with typed functions: `createConversation`, `getConversation`, `listConversations`, `updateConversation`, `deleteConversation`.

#### Scenario: List conversations ordered by updated_at

- **WHEN** `listConversations(projectId)` is called
- **THEN** it returns conversations for that project in descending `updated_at` order

#### Scenario: Delete cascades messages and artifacts

- **WHEN** `deleteConversation(id)` is called
- **THEN** all messages and artifacts in that conversation are deleted from the database

### Requirement: Typed repository for Messages

The system SHALL provide a `messages` repository module with typed functions: `createMessage`, `listMessages`.

#### Scenario: Messages ordered by sequence_order

- **WHEN** `listMessages(conversationId)` is called
- **THEN** it returns messages in ascending `sequence_order`

#### Scenario: Duplicate sequence_order rejected

- **WHEN** `createMessage` is called with a `sequence_order` that already exists in the conversation
- **THEN** it throws a `DatabaseError`

### Requirement: Typed repository for Artifacts

The system SHALL provide an `artifacts` repository module with typed functions: `createArtifact`, `getArtifact`, `listArtifacts`, `updateArtifact`.

#### Scenario: List artifacts by conversation

- **WHEN** `listArtifacts(conversationId)` is called
- **THEN** it returns all artifacts for that conversation ordered by `version`

### Requirement: Typed repository for LLM Providers

The system SHALL provide an `llm-providers` repository module with typed functions: `createLlmProvider`, `getLlmProvider`, `listLlmProviders`, `updateLlmProvider`, `deleteLlmProvider`, `setDefaultProvider`.

#### Scenario: Only one default provider allowed

- **WHEN** `setDefaultProvider(id)` is called
- **THEN** all other providers have `is_default = 0` and the specified provider has `is_default = 1`

### Requirement: App settings accessed via settings module

The system SHALL provide a `settings` module replacing the old `config.ts`, with functions `getSetting`, `setSetting`, and typed constant keys for known settings (`theme`, `approval_mode`, `editor_autosave_interval_ms`).

#### Scenario: Get existing setting

- **WHEN** `getSetting('theme')` is called after database initialization
- **THEN** it returns the stored value (default `"system"` on first run)

#### Scenario: Set setting persists value

- **WHEN** `setSetting('theme', '"dark"')` is called
- **THEN** subsequent `getSetting('theme')` returns `'"dark"'`

### Requirement: Old configuration API removed

The system SHALL NOT export `loadConfiguration`, `saveConfigurationEntry`, `saveConfiguration`, or the `Configuration` type from `src/lib/db/`.

#### Scenario: Old exports cause compile error

- **WHEN** a module imports `loadConfiguration` from `src/lib/db`
- **THEN** TypeScript reports an error (the export does not exist)
