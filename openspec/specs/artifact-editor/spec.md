# Spec: Artifact Editor

## Requirements

### Requirement: Artifact store loads artifacts for the active conversation
The system SHALL load all artifacts for the active conversation from SQLite into `artifactStore` when the chat route loader runs, and SHALL automatically activate the most recently updated artifact.

#### Scenario: Artifacts load on chat navigation
- **WHEN** the route loader runs for `/projects/:projectId/chats/:chatId`
- **THEN** `artifactStore.loadForConversation(chatId)` populates `artifacts` and sets `activeArtifactId` to the artifact with the highest `version`

#### Scenario: No artifacts triggers initial artifact creation
- **WHEN** `artifactStore.loadForConversation()` finds zero artifacts for the conversation
- **THEN** a new artifact is created with `version: 1`, empty `content`, and `title: null`, and it becomes the active artifact

---

### Requirement: Active artifact content is displayed and editable in the TipTap editor
The system SHALL render the active artifact's `content` in the `Editor` component via the `content` prop. The user SHALL be able to edit the content, and changes SHALL be propagated via the `onChange` callback. The `Editor` component SHALL accept a `isStreaming` prop that disables editing while the AI is writing. Auto-save behavior (debounce, SQLite write) is managed by `EditorPanel` and `artifactStore`, not by `Editor` itself.

#### Scenario: Editor displays artifact content on load

- **WHEN** `artifactStore.activeArtifact` is set
- **THEN** `EditorPanel` passes `content={headRevision?.content ?? ''}` to `Editor`

#### Scenario: User edits propagate via onChange

- **WHEN** the user makes changes in the `Editor`
- **THEN** `Editor` calls `onChange(html)` with the updated HTML content
- **AND** `EditorPanel` forwards this to `artifactStore.updateContent(html)`

#### Scenario: Editor is read-only during streaming

- **WHEN** `messageStore.isStreaming` is `true`
- **THEN** `EditorPanel` passes `isStreaming={true}` to `Editor` and the editor surface is non-editable

#### Scenario: Editor becomes editable after streaming

- **WHEN** `messageStore.isStreaming` becomes `false`
- **THEN** `EditorPanel` passes `isStreaming={false}` and the editor is editable again

---

### Requirement: Artifact title is editable inline above the editor
The system SHALL display the artifact title in a large, Google Docs-style heading above the editor. The user SHALL be able to click the title to edit it inline, and the change SHALL be persisted to `Artifact.title` on blur or Enter.

#### Scenario: Untitled artifact shows placeholder
- **WHEN** `activeArtifact.title` is `null` or empty
- **THEN** `ArtifactTitleBar` displays "Untitled" in muted foreground color

#### Scenario: Click activates inline title editing
- **WHEN** the user clicks the title area
- **THEN** the title becomes an editable `<input>` pre-filled with the current title (or empty for Untitled)

#### Scenario: Title is saved on blur or Enter
- **WHEN** the user presses Enter or moves focus away from the title input
- **THEN** `artifactStore.rename(newTitle)` is called and `updateArtifact({ title })` is written to SQLite

#### Scenario: Empty title reverts to null
- **WHEN** the user clears the title input and blurs
- **THEN** `title` is saved as `null` and the placeholder "Untitled" is shown again

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

#### Scenario: Artifact version history stub is present
- **WHEN** `ArtifactTitleBar` renders
- **THEN** a commented stub zone exists for an artifact version badge/selector (e.g., "v3 of 5")

#### Scenario: Link-to-file stub is present
- **WHEN** `ArtifactTitleBar` renders
- **THEN** a commented stub zone exists for a "Link to file" button (FR-EDT-010)
