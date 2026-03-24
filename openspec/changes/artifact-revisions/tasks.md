# Tasks: Artifact Revisions

## 1. Types & Pure Utilities

- [x] 1.1 Update `src/lib/types.ts`: replace `Artifact` type (remove `content`, `version`; add `currentRevisionId`), add `ArtifactRevision`, `SaveRequest`, `ContentSwapRequest`, `SealResult`, `ThreadItem`
- [x] 1.2 Create `src/lib/revision-utils.ts` with pure functions: `canEditInPlace`, `findLastSealedRevision`, `hasContentChangedSinceLastSeal`
- [x] 1.3 Add `buildThread(messages, revisions): ThreadItem[]` to `src/lib/revision-utils.ts` — merges messages and sealed revision cards in chronological order

## 2. Database Migration

- [x] 2.1 Write the SQL migration in `src-tauri/src/commands/db.rs`: drop and recreate `artifacts` table (no `content`/`version`; add `current_revision_id`), create `artifact_revisions` table, add `active_artifact_id` to `conversations`
- [x] 2.2 Include data migration in the SQL: for each existing `artifacts` row insert one `artifact_revisions` row copying content, set `current_revision_id`, set `conversations.active_artifact_id`; run in a transaction
- [x] 2.3 Update `prisma/schema.prisma` to reflect new tables and removed columns; add cross-reference comments per database-schema spec

## 3. DB Helpers (`src/lib/db.ts`)

- [x] 3.1 Add artifact helpers: `getArtifactForConversation`, `insertArtifact`, `updateArtifactHead`, `updateArtifactFileHash`, `setConversationActiveArtifact`
- [x] 3.2 Add revision helpers: `getRevisionsForArtifact`, `insertRevision`, `updateRevisionContent`, `sealRevision`
- [x] 3.3 Add `mapArtifactRow` and `mapRevisionRow` row-mapper functions (DB snake_case → TS camelCase)

## 4. Artifact Store — Skeleton & Lifecycle

- [x] 4.1 Rewrite `src/stores/artifact.store.ts` state shape: `artifact`, `headRevision`, `loadedRevisionId`, `revisions`, `contentSwapRequest`, `isSaving`, `saveError`, `externalChangeDetected`; add non-reactive `_flushRef: { current: null }` (plain mutable object, not Zustand state)
- [x] 4.2 Implement `reset()`: clear all state to initial values
- [x] 4.3 Implement `_requestContentSwap(revisionId, content)`: sets `loadedRevisionId` and `contentSwapRequest`
- [x] 4.4 Implement `acknowledgeSwap()`: sets `contentSwapRequest` to null
- [x] 4.5 Implement `loadForConversation(conversationId)`: fetch artifact + all revisions; create initial empty user-draft artifact+revision if none exist; call `_requestContentSwap`; update `conversations.active_artifact_id` on creation; run `checkExternalChange` if artifact has a linked file
- [x] 4.6 Implement `_createUserDraft(content)`: insert new `author='user'`, `messageId=null` revision, update artifact HEAD, update store state; return the new draft

## 5. Artifact Store — Save Chain

- [x] 5.1 Implement `save(request: SaveRequest)` entry point: stale-revision check (`loadedRevisionId !== revisionId` → return), `isSaving` concurrency guard (→ return), then route to chain
- [x] 5.2 Implement `_persistToHead(content)`: update HEAD revision content in DB and store state; call `_syncToDiskIfLinked`
- [x] 5.3 Implement `_createDraftThenPersist(content)`: call `_createUserDraft`, update `loadedRevisionId` (triggers `revisionIdRef` sync in editor via `useLayoutEffect`); call `_syncToDiskIfLinked`
- [x] 5.4 Implement `_createDraftFromOldRevision(content)`: same as `_createDraftThenPersist` but used when editing a non-HEAD revision
- [x] 5.5 Implement `_syncToDiskIfLinked(content)`: write to disk via `invoke('write_file', ...)`, update `file_hash` in DB; on failure set `saveError` (DB save already succeeded — [ERR-EDT-002])

## 6. Artifact Store — Seal Chain

- [x] 6.1 Implement `sealForSend(messageId)` entry point: determine `isDraft` and `changed` flags; route to one of four chain links
- [x] 6.2 Implement `_sealDraftInPlace(messageId)`: call `db.sealRevision`, update store state, return `SealResult`
- [x] 6.3 Implement `_reuseLastSealed()`: return last sealed revision or HEAD as fallback; no DB write
- [x] 6.4 Implement `_createSealedRevision(messageId)`: insert new sealed user revision, update artifact HEAD and `loadedRevisionId`, return `SealResult`
- [x] 6.5 Implement `_reuseCurrentHead()`: return HEAD as `SealResult`; no DB write

## 7. Artifact Store — External Triggers & File Sync

- [x] 7.1 Implement `applyAiRevision(content, messageId)`: insert new `author='ai'` revision, update HEAD, set `contentSwapRequest`
- [x] 7.2 Implement `requestRevisionLoad(revisionId)`: find revision in store, call `_requestContentSwap` (does NOT change `current_revision_id`)
- [x] 7.3 Implement `createNewArtifact(conversationId)`: insert new artifact + empty user-draft revision, update `conversations.active_artifact_id`, set `contentSwapRequest`
- [x] 7.4 Implement `checkExternalChange()`: hash disk file, compare to `artifact.fileHash`, set `externalChangeDetected` if different
- [x] 7.5 Implement `reloadFromDisk()`: read file content, create new user-draft revision from it, clear `externalChangeDetected`
- [x] 7.6 Implement `linkToDisk(relativePath)`: update `artifact.filePath` in DB, write current HEAD content to disk, compute and store `fileHash`

## 8. EditorPanel Rewrite

- [x] 8.1 Rewrite `src/components/editor/EditorPanel.tsx`: add `revisionIdRef`, `debounceTimerRef`, `editorRef`; wire `useEditor` `onUpdate` to debounce (1s), `onCreate`/`onDestroy` to maintain `editorRef`
- [x] 8.2 Implement `flushPendingSave(): Promise<void>`: cancel debounce timer; re-read fresh content via `editor.storage.markdown.getMarkdown()` (not a stale ref); call `artifactStore.save()` and return the promise
- [x] 8.3 Implement `useLayoutEffect` #1 (content swap): observe `contentSwapRequest` — cancel pending debounce, call `editor.commands.setContent(content, false)`, call `editor.commands.clearHistory()`, set `revisionIdRef.current`, call `acknowledgeSwap()`
- [x] 8.4 Implement `useLayoutEffect` #2 (revisionIdRef sync): observe `loadedRevisionId` — when it changes AND no `contentSwapRequest` is pending, set `revisionIdRef.current = loadedRevisionId`
- [x] 8.5 Write `flushPendingSave` into `artifactStore._flushRef.current` on mount (not in an effect — just assign in render body since `_flushRef` is non-reactive)
- [x] 8.6 Add `useLayoutEffect` cleanup: clear debounce timer on unmount

## 9. Sidecar Store Integration

- [x] 9.1 Update `src/stores/sidecar.store.ts` `sendChatRequest(userMessage, sealResult: SealResult | null)`: include `artifact: { artifactId, revisionId, content }` in `ChatCompletionRequest` when `sealResult` is not null
- [x] 9.2 Update `_dispatch` `completion.response` case: call `artifactStore.applyAiRevision(content, messageId)` instead of old artifact action

## 10. Chat Send Handler

- [x] 10.1 Update the send handler in `ChatInput.tsx` (or wherever `handleSend` lives): `await artStore._flushRef.current?.()` before calling `sealForSend`; then `await artStore.sealForSend(msgId)`; then `sidecaStore.sendChatRequest(message, sealResult)`

## 11. Revision Cards in Chat Thread

- [x] 11.1 Create `src/components/chat/RevisionCard.tsx`: displays "AI updated the document" / "You sent this document version" label, formatted timestamp, and a "Load" button that calls `artifactStore.requestRevisionLoad(revisionId)`
- [x] 11.2 Update `src/components/chat/MessageList.tsx` (or `ChatLayout.tsx`): use `buildThread(messages, revisions)` to produce a `ThreadItem[]` and render either `MessageBubble` or `RevisionCard` per item; draft revisions (`messageId === null`) are excluded by `buildThread`

## 12. Revision History Picker

- [x] 12.1 Create `src/components/editor/RevisionPicker.tsx`: dropdown listing all revisions with `v{n}`, author label ("AI" / "You"), draft indicator, and timestamp; shows "Version N of M" trigger; current loaded revision is highlighted; hides when `revisions.length <= 1`
- [x] 12.2 Update `src/components/editor/EditorPanel.tsx` header: render `<RevisionPicker />` replacing the version badge stub

## 13. New Artifact Button

- [x] 13.1 Add "New Artifact" button to `src/pages/ChatPage.tsx` or `src/components/chat/ChatLayout.tsx` header — visible at all times, not disabled during streaming
- [x] 13.2 Wire button to `artifactStore.createNewArtifact(activeConversationId)`

## 14. Router & Loader Updates

- [x] 14.1 Verify chat route loader in `src/router.tsx` calls `artifactStore.loadForConversation(chatId)` (which now loads revisions) and that `conversation.active_artifact_id` is the basis for active artifact selection

## 15. Project Spec Updates

- [x] 15.1 Update `openspec/specs/project/spec.md` §5.4 (artifact store): replace state shape, action signatures, and pattern description with revision-based design
- [x] 15.2 Update `openspec/specs/project/spec.md` §5.4.4 (EditorPanel): describe `revisionIdRef`, `_flushRef`, `contentSwapRequest` swap pattern, and debounce-in-component approach
- [x] 15.3 Update `openspec/specs/project/spec.md` §6.1 (DB schema) if the migration SQL block is reproduced there

## 16. Tests

- [x] 16.1 Unit tests for `revision-utils.ts`: `canEditInPlace`, `findLastSealedRevision`, `hasContentChangedSinceLastSeal`, `buildThread`
- [x] 16.2 Save chain unit tests (one per link + stale-ID discard + `isSaving` concurrency guard = 6 tests)
- [x] 16.3 Seal chain unit tests (one per link = 4 tests)
- [x] 16.4 Lifecycle unit tests: `loadForConversation` (new + existing), `applyAiRevision`, `requestRevisionLoad`, `acknowledgeSwap`, `createNewArtifact`
- [ ] 16.5 `EditorPanel` component tests: content swap via `contentSwapRequest`, debounce fires after 1s, `flushPendingSave` re-reads fresh editor content, `revisionIdRef` sync on `loadedRevisionId` change without swap, Strict Mode idempotency
- [x] 16.6 DB integration tests: full revision CRUD, `updateArtifactHead`, `sealRevision`, CASCADE delete, `ON DELETE SET NULL` for message FK
- [ ] 16.7 E2E flows: auto-save revision, AI revision cycle, revision picker revert, seal-on-send
