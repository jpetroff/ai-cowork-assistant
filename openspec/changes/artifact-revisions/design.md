## Context

AI CoLab currently stores artifact content as a single mutable `content` column on the `artifacts` table. Each AI response replaces the content in-place, and the previous state is lost. There is no history, no undo of AI edits beyond TipTap's in-memory undo stack, and no way to see what the document looked like at any earlier point in the conversation.

The `artifact_revisions_specification.md` (v3.0) is a fully-worked design document that resolves all of this. This implementation change adopts that design as the authoritative spec, migrates the schema, rewrites the affected stores and components, and adds the user-initiated New Artifact button.

Current constraint: the project uses Zustand 5, React 19, TipTap 2, Tauri plugin-sql, and a no-`useEffect`-in-components discipline (side effects live in store actions or route loaders). All decisions below respect these constraints.

## Goals / Non-Goals

**Goals:**
- Introduce an `artifact_revisions` chain so every content change (user edit sealed on send, AI response) is a permanent immutable snapshot.
- Allow users to revert to any prior revision via a picker in the editor title bar.
- Surface sealed revision cards in the chat thread anchored to the messages that produced them.
- Provide a "New Artifact" button on the Chat page so users can start a blank document without an AI exchange.
- Keep the store timer-free: debounce lives in `EditorPanel`, the store executes immediately when called.
- Prevent stale-write races via a `revisionIdRef` carried from the editor on every save call.

**Non-Goals:**
- Multiple artifacts per conversation in the UI (schema supports it; deferred).
- Side-by-side diff view between revisions.
- AI change highlighting (FR-EDT-012, deferred).
- Collaborative editing.

## Decisions

### 1. Chain-of-responsibility save pattern (no conditional ladders)

**Decision:** `artifactStore.save(request)` delegates through a chain of pure functions: `_trySaveInPlace → _tryCreateDraftAndSave → _noOp`. Each checks one precondition and either acts or delegates.

**Why:** Single-responsibility functions are independently testable and produce clear stack traces. The original flat model had nested `if/else if/else` that conflated three distinct cases (in-place update, copy-on-write draft creation, stale write discard).

**Alternative considered:** A single `save()` with a switch on state. Rejected because it conflates concerns and is harder to extend.

### 2. Revision ID as staleness token

**Decision:** Every `onChange` from the editor carries the `revisionId` that was active when the editor loaded. `artifactStore.save({ revisionId, content })` discards the write silently if `revisionId !== headRevision.id`.

**Why:** Eliminates the need for an `isSwappingContent` boolean guard. The condition is already expressed by the mismatched IDs. The editor cannot accidentally overwrite content that has changed underneath it (AI revision arriving mid-debounce).

**Alternative considered:** `isSwappingContent` flag on the store. Rejected because it requires coordinated set/clear across async boundaries and is easy to leave in a stuck state.

### 3. Content swap via `contentSwapRequest` signal

**Decision:** The store never calls `editor.setContent()` directly. When it needs to change editor content (load, AI revision, revert), it sets `state.contentSwapRequest = { revisionId, content }`. `EditorPanel` observes this in `useLayoutEffect`, performs `editor.setContent(content)` + `editor.commands.clearHistory()`, updates `revisionIdRef.current`, then calls `artifactStore.acknowledgeSwap()`.

**Why:** Maintains one-way data flow. The store has no reference to the TipTap editor instance; the component owns the editor. Swaps are synchronous with layout so the user never sees intermediate states.

**Alternative considered:** Passing an `editorRef` into the store. Rejected — it couples the store to a DOM/framework object and breaks testability.

### 4. Debounce owned by `EditorPanel`, not the store

**Decision:** `EditorPanel` holds a `debounceTimerRef`. On every `onChange` from the TipTap editor, it resets the timer and schedules `artifactStore.save({ revisionId: revisionIdRef.current, content })` 1 second later. The store has zero `setTimeout` calls.

**Why:** The store should be a pure state machine that responds to explicit calls. Timers inside stores complicate testing (fake timers needed) and make the flush-before-send coordination awkward. With debounce in the component, `sealForSend` can flush by calling `flushRef.current()` directly.

**Alternative considered:** Debounce inside `artifactStore.save()`. Rejected because it requires the store to hold a timer ref and a flush callback, blurring responsibility.

### 5. `revisionIdRef` as single source of truth for editor's current revision

**Decision:** `revisionIdRef` in `EditorPanel` is the authoritative record of which revision the editor is editing. It is updated in exactly two `useLayoutEffect` paths: (a) when a `contentSwapRequest` is processed, and (b) when `loadedRevisionId` changes without a swap (draft-creation — the store created a new revision in-place and the editor content is already correct, only the ID needs updating).

**Why:** Avoids any scenario where the ref drifts out of sync with store state. Exactly two update sites means the invariant is easy to audit.

### 6. New Artifact button creates a sealed user draft

**Decision:** The "New Artifact" button in `ChatPage` calls `artifactStore.createNewArtifact(conversationId)`. This inserts a new `artifacts` row and an empty `author='user'`, `message_id=null` revision as HEAD, then sets it as the active artifact via `conversations.active_artifact_id`. The editor loads the blank content via a `contentSwapRequest`.

**Why:** This satisfies FR-CHT-004 (each new conversation starts with an empty artifact) and extends it to user-initiated creation mid-conversation. It reuses the same revision creation path as the rest of the system.

### 7. Clean-slate DB migration

**Decision:** Migration drops and recreates `artifacts` (removing `content` and `version`), creates `artifact_revisions`, and adds `active_artifact_id` to `conversations`. Existing artifact content is migrated: for each existing artifact row, one `artifact_revisions` row is inserted with `author='user'`, `message_id=null`, and `content` copied from the old column.

**Why:** The schema change is too structural for an incremental ALTER. Clean-slate with data migration is simpler and less error-prone than nullable interim columns.

**Risk:** Existing data is transformed non-reversibly. Mitigation: the migration runs inside a transaction; if it fails, no data is lost and the app shows an error.

## Risks / Trade-offs

- **[Stale `revisionIdRef` after draft creation]** — If `createDraftRevision` inserts a new row and returns the new ID, but the component's `revisionIdRef` still holds the old ID, the next debounce save will be discarded. Mitigation: the store sets `loadedRevisionId` to the new revision ID; `EditorPanel`'s second `useLayoutEffect` path (no content swap) updates `revisionIdRef` synchronously before the next save fires.

- **[Content swap during active typing]** — If an AI revision arrives while the user is mid-sentence, `contentSwapRequest` will overwrite the editor and clear undo history. Mitigation: the sidecar's `applyAiRevision` is only called on `completion.response` (final event), not on chunks. The debounce (1 s) will have already flushed by the time the final event arrives in typical usage.

- **[Migration on large artifact datasets]** — For users with many large artifacts, the migration transaction could take several seconds. Mitigation: run migration at startup with a loading indicator already shown; this is already part of the boot sequence (`app.store.ts init()`).

- **[TipTap `clearHistory` UX]** — Calling `editor.commands.clearHistory()` on a revision load means Ctrl+Z cannot undo across revision boundaries. This is intentional (revision history replaces undo across revisions) but users accustomed to deep undo may be surprised. Trade-off accepted; the revision picker provides the alternative.

## Migration Plan

1. The existing `run_migrations` Rust command runs the SQL migration at app startup inside a transaction.
2. Migration inserts one `artifact_revisions` row per existing `artifacts` row, copying content.
3. Sets `artifacts.current_revision_id` to the new revision ID for each migrated artifact.
4. Sets `conversations.active_artifact_id` to the conversation's artifact ID where one exists.
5. Drops the old `content` and `version` columns (SQLite: recreate table approach).
6. Rollback: the migration runs in a single transaction; failure leaves the DB unchanged.

## Open Questions

- Should the revision history picker in the editor title bar show revision timestamps, AI message previews, or both? (Spec implies timestamps + author label; leave UX detail to the design phase.)
- Should the New Artifact button be in the editor toolbar, the chat header, or a floating action button? (Proposed: chat panel header, near the conversation title — consistent with conversation-level actions.)
