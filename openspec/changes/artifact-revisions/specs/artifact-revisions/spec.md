## ADDED Requirements

### Requirement: Revision history picker allows navigating to any past revision
The system SHALL display a revision history picker in the `ArtifactTitleBar` that lists all revisions for the active artifact, ordered by `created_at` DESC. Selecting a revision SHALL trigger a content swap in the editor via a `contentSwapRequest` without changing `artifact.current_revision_id`.

#### Scenario: Picker shows all revisions with author and timestamp
- **WHEN** the user opens the revision history picker
- **THEN** each revision is listed with its `author` label ("You" for `user`, "AI" for `ai`), creation timestamp, and — if sealed — the first few words of the linked message

#### Scenario: Selecting a historical revision swaps editor content
- **WHEN** the user clicks a revision in the history picker
- **THEN** `artifactStore.requestRevisionLoad(revisionId)` is called, a `contentSwapRequest` is set on the store, and the editor displays the selected revision's content without modifying `current_revision_id`

#### Scenario: Current HEAD revision is visually indicated
- **WHEN** the history picker is open
- **THEN** the revision matching `artifact.current_revision_id` is marked as "current"

---

### Requirement: Content swap requests are processed synchronously by the editor in useLayoutEffect
The system SHALL use a `contentSwapRequest` signal (set on `artifactStore`) as the sole mechanism for the store to update editor content. The `EditorPanel` component SHALL observe `contentSwapRequest` via `useLayoutEffect`, call `editor.setContent(content)` and `editor.commands.clearHistory()`, update `revisionIdRef.current` to the new revision ID, then call `artifactStore.acknowledgeSwap()` to clear the signal.

#### Scenario: Store sets contentSwapRequest, editor processes it
- **WHEN** `artifactStore.contentSwapRequest` is set to `{ revisionId, content }`
- **THEN** `EditorPanel`'s `useLayoutEffect` fires, replaces editor content, clears TipTap history, updates `revisionIdRef`, and calls `acknowledgeSwap()`

#### Scenario: Swap acknowledgment clears the signal
- **WHEN** `acknowledgeSwap()` is called
- **THEN** `artifactStore.contentSwapRequest` is set to `null`

#### Scenario: No double-swap on re-render
- **WHEN** `EditorPanel` re-renders after acknowledgment
- **THEN** `contentSwapRequest` is `null` and no swap is performed

---

### Requirement: revisionIdRef is the sole authority for which revision the editor is editing
The system SHALL maintain a `revisionIdRef` in `EditorPanel` that tracks the revision ID currently loaded in the TipTap editor. It SHALL be updated in exactly two places: (a) inside the `useLayoutEffect` that processes a `contentSwapRequest`, and (b) inside a `useLayoutEffect` that observes `artifactStore.loadedRevisionId` changing without a pending swap (draft-creation case). No other code path SHALL write to `revisionIdRef`.

#### Scenario: revisionIdRef updated on content swap
- **WHEN** a `contentSwapRequest` is processed
- **THEN** `revisionIdRef.current` is set to `contentSwapRequest.revisionId` before `acknowledgeSwap()` is called

#### Scenario: revisionIdRef updated after draft creation without swap
- **WHEN** the store creates a new draft revision (copy-on-write) and `loadedRevisionId` changes but no `contentSwapRequest` is set
- **THEN** the second `useLayoutEffect` updates `revisionIdRef.current` to the new `loadedRevisionId`

#### Scenario: Stale write is silently discarded
- **WHEN** `EditorPanel` calls `artifactStore.save({ revisionId, content })` with a `revisionId` that no longer matches `headRevision.id`
- **THEN** the store discards the write without error and does not update any DB row
