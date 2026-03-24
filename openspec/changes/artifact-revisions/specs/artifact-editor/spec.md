## MODIFIED Requirements

### Requirement: Artifact store loads artifacts for the active conversation
The system SHALL load all artifacts AND all their revisions for the active conversation from SQLite into `artifactStore` when the chat route loader runs. It SHALL automatically activate the artifact referenced by `conversation.active_artifact_id`, or the artifact with the most recent `updated_at` if `active_artifact_id` is null. For each loaded artifact, `headRevision` SHALL be set to the revision matching `artifact.current_revision_id`.

#### Scenario: Artifacts and revisions load on chat navigation
- **WHEN** the route loader runs for `/projects/:projectId/chats/:chatId`
- **THEN** `artifactStore.loadForConversation(chatId)` populates `artifacts`, `revisions`, and `headRevision`; `activeArtifactId` is set to `conversation.active_artifact_id` (or the most recently updated artifact's ID if null)

#### Scenario: No artifacts triggers initial artifact creation with empty revision
- **WHEN** `artifactStore.loadForConversation()` finds zero artifacts for the conversation
- **THEN** a new artifact is created with `title: null`, an empty `author='user'` revision becomes HEAD, `current_revision_id` is set, and `conversations.active_artifact_id` is updated

---

### Requirement: Active artifact content is displayed and editable in the TipTap editor
The system SHALL render the HEAD revision's `content` in the `Editor` component via a `contentSwapRequest` signal. The user SHALL be able to edit the content, and changes SHALL be propagated via the `onChange(content, revisionId)` callback — the callback SHALL carry the revision ID from `EditorPanel`'s `revisionIdRef` alongside the current content. The `Editor` component SHALL accept an `isStreaming` prop that disables editing while the AI is writing. Auto-save debounce is owned by `EditorPanel`, not the store or `Editor`.

#### Scenario: Editor displays HEAD revision content on load
- **WHEN** `artifactStore.headRevision` is set
- **THEN** `EditorPanel` issues a `contentSwapRequest` with `{ revisionId: headRevision.id, content: headRevision.content ?? '' }` and the editor renders that content

#### Scenario: User edits propagate via onChange with revisionId
- **WHEN** the user makes changes in the `Editor`
- **THEN** `Editor` calls `onChange(content, revisionIdRef.current)` with the current markdown content and the revision ID that was active when editing began

#### Scenario: EditorPanel debounces and calls save after 1 second
- **WHEN** `onChange` fires
- **THEN** `EditorPanel` resets its debounce timer; after 1 second of inactivity, `artifactStore.save({ revisionId, content })` is called

#### Scenario: Editor is read-only during streaming
- **WHEN** `messageStore.isStreaming` is `true`
- **THEN** `EditorPanel` passes `isStreaming={true}` to `Editor` and the editor surface is non-editable

#### Scenario: Editor becomes editable after streaming
- **WHEN** `messageStore.isStreaming` becomes `false`
- **THEN** `EditorPanel` passes `isStreaming={false}` and the editor is editable again

---

### Requirement: Stub zones are present and marked for future AI integration
The system SHALL include clearly marked stub zones for features not yet implemented, so future contributors can identify integration points without reading design documents.

#### Scenario: Tool call indicator stub is present
- **WHEN** the message list renders
- **THEN** a commented stub zone exists for rendering tool call step indicators (e.g., "Reading file X…") between the streaming bubble and the message list

#### Scenario: HITL approval stub is present
- **WHEN** the message list renders
- **THEN** a commented stub zone exists for rendering a human-in-the-loop approval card for AI-proposed actions

#### Scenario: Selection context stub is present in chat input
- **WHEN** the chat input renders
- **THEN** a commented stub zone exists above the textarea for a badge showing editor-selected text context

#### Scenario: Revision history picker is present and functional
- **WHEN** `ArtifactTitleBar` renders
- **THEN** a revision history picker is shown (replacing the version badge stub) that lists all revisions and allows the user to navigate to any one

#### Scenario: Link-to-file stub is present
- **WHEN** `ArtifactTitleBar` renders
- **THEN** a commented stub zone exists for a "Link to file" button (FR-EDT-010)
