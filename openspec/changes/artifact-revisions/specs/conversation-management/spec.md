## ADDED Requirements

### Requirement: Chat route loader loads artifact revisions alongside the artifact
The system SHALL, when the chat route loader runs for `/projects/:projectId/chats/:chatId`, call `artifactStore.loadForConversation(chatId)` which SHALL fetch both the `artifacts` row AND all associated `artifact_revisions` rows for the conversation in a single loader pass. The revisions SHALL be sorted by `created_at` ASC. The active artifact SHALL be determined by `conversation.active_artifact_id`.

#### Scenario: Revisions are available in the store before any component renders
- **WHEN** the chat route loader completes
- **THEN** `artifactStore.revisions` is populated with all revisions for the active artifact, ordered by `created_at` ASC, before `ChatPage` renders

#### Scenario: Switching conversations reloads revisions for the new conversation
- **WHEN** the user navigates from one conversation to another
- **THEN** the chat route loader re-runs, `artifactStore` is reset, and revisions for the new conversation's artifact are loaded

---

### Requirement: conversations.active_artifact_id is kept in sync when artifacts change
The system SHALL update `conversations.active_artifact_id` in SQLite whenever the active artifact changes for a conversation: on initial artifact creation, on user-initiated new artifact creation, and on explicit artifact selection (future multi-artifact UI). The value SHALL be read by the chat route loader to restore the last active artifact across sessions.

#### Scenario: Initial artifact creation sets active_artifact_id
- **WHEN** `loadForConversation` finds no artifacts and creates an initial empty artifact
- **THEN** `conversations.active_artifact_id` is set to the new artifact's ID in SQLite

#### Scenario: New Artifact button updates active_artifact_id
- **WHEN** `artifactStore.createNewArtifact(conversationId)` completes
- **THEN** `conversations.active_artifact_id` is updated to the new artifact's ID in SQLite

#### Scenario: active_artifact_id persists across sessions
- **WHEN** the user closes the app and reopens it, then navigates to a conversation
- **THEN** the chat route loader reads `conversation.active_artifact_id` and the last active artifact is displayed with its HEAD revision content
