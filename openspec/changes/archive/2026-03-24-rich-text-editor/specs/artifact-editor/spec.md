## MODIFIED Requirements

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
