## Why

The current artifact model stores all content directly on the `artifacts` row — one flat mutable record per artifact. This means every AI response overwrites the previous content with no history, making it impossible to undo AI edits or review what changed between messages. The detailed specification (`artifact_revisions_specification.md` v3.0) defines a complete revision chain architecture that solves this; the change codifies that design into the project's tracked specs and implementation plan, and adds a user-initiated "New Artifact" button to the Chat page so users can create a blank artifact without waiting for the AI.

## What Changes

- **BREAKING** — DB migration: `artifacts` table drops the `content`, `version` columns; a new `artifact_revisions` table is added to hold all content snapshots; `conversations` gains an `active_artifact_id` column.
- `artifact.store.ts` is fully rewritten to a chain-of-responsibility save/seal pattern operating on `ArtifactRevision` rows rather than mutating `Artifact.content` directly.
- `EditorPanel.tsx` is rewritten to own the debounce timer, carry a `revisionIdRef` for staleness detection, and process content swaps via `useLayoutEffect` responding to a `contentSwapRequest` signal from the store.
- Revision history picker added to the editor title bar — users can navigate to any past revision.
- Revision cards (sealed snapshots anchored to AI messages) rendered inside the chat thread.
- `sidecar.store.ts` `_dispatch` updated to call the new `applyAiRevision` action.
- Chat page gets a **New Artifact** button that creates a blank user-authored revision without requiring an AI response.
- `router.tsx` chat-route loader updated to load revisions alongside the artifact.
- New pure helper module `revision-utils.ts` (`canEditInPlace`, `findLastSealedRevision`, `hasContentChangedSinceLastSeal`).

## Capabilities

### New Capabilities

- `artifact-revisions`: Revision chain lifecycle — HEAD concept, in-place edit gating, seal-on-send, AI revision application, revision history picker, and revert to any past revision.
- `new-artifact-button`: User-initiated blank artifact creation from the Chat page via a dedicated button, independent of AI responses.

### Modified Capabilities

- `artifact-editor`: The `artifact-editor` spec's auto-save and content-loading requirements change materially — debounce ownership moves to the editor component, content is loaded from `headRevision.content` not `artifact.content`, and staleness is tracked by revision ID rather than an `isSwappingContent` flag.
- `database-schema`: Schema changes to `artifacts` (drop `content`/`version`), new `artifact_revisions` table, and `conversations.active_artifact_id` column are breaking schema-level changes.
- `conversation-management`: `loadForConversation` in the chat-route loader must additionally load the artifact's revisions; `active_artifact_id` on `conversations` must be set when a new artifact is created.

## Impact

- **Database**: Clean-slate migration required — existing `artifacts` data must be migrated to `artifact_revisions` rows.
- **`artifact.store.ts`**: Full rewrite; all callers (`ChatPage`, `EditorPanel`, `sidecar.store.ts`) must update import signatures.
- **`EditorPanel.tsx` / `Editor` component**: Rewrite; the `onChange` API is extended to carry `revisionId` with every call.
- **`ChatLayout.tsx`**: Revision cards rendered in the message thread alongside AI bubbles.
- **`ChatPage.tsx`**: New Artifact button added to the page header/toolbar area.
- **`db.ts`**: New typed helpers — `createArtifactRevision`, `updateRevisionContent`, `getRevisionsForArtifact`, `getRevision`, `sealRevision`.
- **`router.tsx`**: Chat-route loader extended to call `artifactStore.loadForConversation()` which now fetches both artifact metadata and all revisions.
- **`types.ts`**: New `ArtifactRevision`, `SaveRequest`, `ContentSwapRequest`, `SealResult` types; `Artifact` type loses `content`/`version`, gains `currentRevisionId`.
- No new npm dependencies required.
