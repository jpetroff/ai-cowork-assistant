## ADDED Requirements

### Requirement: A New Artifact button is present in the Chat page header
The system SHALL render a "New Artifact" button in the `ChatPage` header area (near the conversation title or editor panel header). The button SHALL be visible at all times when a conversation is active and SHALL NOT be disabled during AI streaming.

#### Scenario: Button is visible on the Chat page
- **WHEN** the user navigates to a conversation
- **THEN** a "New Artifact" button is visible in the Chat page header

#### Scenario: Button is present during streaming
- **WHEN** the AI is streaming a response
- **THEN** the "New Artifact" button remains visible and interactive

---

### Requirement: Clicking New Artifact creates a blank user-authored revision as the active artifact
The system SHALL, when the user clicks "New Artifact", call `artifactStore.createNewArtifact(conversationId)`. This SHALL insert a new `artifacts` row, create an empty `author='user'`, `message_id=null` revision as HEAD, set `artifact.current_revision_id` to that revision's ID, update `conversations.active_artifact_id` to the new artifact's ID, and trigger a `contentSwapRequest` to clear the editor.

#### Scenario: New artifact appears in editor immediately
- **WHEN** the user clicks "New Artifact"
- **THEN** the editor clears to blank content within the same render cycle, and the artifact title shows "Untitled"

#### Scenario: New artifact is persisted in SQLite
- **WHEN** the user clicks "New Artifact"
- **THEN** a new row in `artifacts` and a new row in `artifact_revisions` (with empty content) are written to SQLite; `conversations.active_artifact_id` is updated to the new artifact ID

#### Scenario: Previous artifact content is not lost
- **WHEN** the user clicks "New Artifact" while a previous artifact has content
- **THEN** the previous artifact and all its revisions remain in SQLite; only the editor view switches to the new artifact

#### Scenario: Revision history picker lists the new artifact's initial empty revision
- **WHEN** the new artifact is created and the user opens the revision history picker
- **THEN** one revision entry is shown with `author='user'` and empty content
