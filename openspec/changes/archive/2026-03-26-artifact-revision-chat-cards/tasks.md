## 1. Database Schema (Rust — clean slate, single v1 migration)

- [x] 1.1 Update `messages` table in `src-tauri/src/db.rs` v1 migration: add `metadata TEXT` column (nullable) and extend `role` CHECK constraint to include `'system'`

## 2. TypeScript Types and Repository Layer

- [x] 2.1 Update `Message` type in `src/lib/db/types.ts`: extend `role` to `'user' | 'assistant' | 'system'`; add `metadata: string | null` field
- [x] 2.2 Add `RevisionMessageMetadata` helper type in `src/lib/types.ts`: `{ revisionId: string; author: 'user' | 'ai' }`
- [x] 2.3 Add `createSystemRevisionMessage` function in `src/lib/db/repositories/messages.ts`: inserts a system message with serialized metadata and returns the new message id
- [x] 2.4 Update `createMessage` in `src/lib/db/repositories/messages.ts` to include `metadata` in the SELECT result of `listMessages`

## 3. Message Store

- [x] 3.1 Add `addSystemRevisionMessage(author: 'user' | 'ai', revisionId: string): Promise<string>` action to `src/stores/messageStore.ts`: computes next `sequence_order`, calls `createSystemRevisionMessage`, appends to `messages` state, returns new message id

## 4. Artifact Store — Seal Chain

- [x] 4.1 Update `sealForSend` signature in `src/stores/artifactStore.ts`: replace `messageId: string` parameter with `sysMsgCreator?: (revisionId: string, author: 'user' | 'ai') => Promise<string>`
- [x] 4.2 Update `_sealDraftInPlace`: call `sysMsgCreator(headRevision.id, 'user')` to get system message id, then seal revision with that id
- [x] 4.3 Update `_createSealedRevision`: call `sysMsgCreator(newRevisionId, 'user')` after creating the revision, then set `message_id` to system message id
- [x] 4.4 Confirm `_reuseLastSealed` and `_reuseCurrentHead` do not call `sysMsgCreator` (no change needed, just verify)
- [x] 4.5 Update `applyAiRevision` signature: replace `messageId: string` with `sysMsgCreator: (revisionId: string, author: 'user' | 'ai') => Promise<string>`; call it after creating the revision to get the system message id, set `message_id` accordingly

## 5. Sidecar Store — AI Response Orchestration

- [x] 5.1 Add `handleAiArtifactResponse(content: string)` method to `src/stores/sidecarStore.ts`: calls `messageStore.addSystemRevisionMessage` via callback and `artifactStore.applyAiRevision` with the creator callback
- [x] 5.2 Replace inline `applyAiRevision(artifactContent, assistantMsgId)` call in `sidecarStore._dispatch` (`'done'` handler) with `handleAiArtifactResponse(artifactContent)`

## 6. Chat Input — Send Flow

- [x] 6.1 Update `ChatInput.handleSubmit` in `src/components/chat/ChatInput.tsx`: pass `sysMsgCreator` callback to `sealForSend` that calls `messageStore.getState().addSystemRevisionMessage`
- [x] 6.2 Remove the `msgId` argument to `sealForSend` (no longer needed; user message id is no longer passed to the seal chain)

## 7. Revision Utils and Thread Building

- [x] 7.1 Update `buildThread` signature in `src/lib/revision-utils.ts`: remove `revisions` parameter; filter system messages with valid `metadata.revisionId`; return sorted `ThreadItem[]`
- [x] 7.2 Update `ThreadItem` type in `src/lib/types.ts`: remove `{ type: 'revision'; data: ArtifactRevision }` variant; all items are now `{ type: 'message'; data: Message }` (renderer inspects `message.role` to decide component)

## 8. Components — Thread Rendering

- [x] 8.1 Create `src/components/chat/ArtifactRevisionCard.tsx`: compact two-line card rendering artifact title (live from store), author label, timestamp, and Load button; reads `revisionId` from parsed `message.metadata`
- [x] 8.2 Update `src/components/chat/MessageList.tsx`: call `buildThread(messages)` (single argument); render `ArtifactRevisionCard` for items where `message.role === 'system'` and `metadata.revisionId` exists, `MessageBubble` otherwise
- [x] 8.3 Delete `src/components/chat/RevisionCard.tsx` (replaced by `ArtifactRevisionCard`)

## 9. Tests

- [x] 9.1 Unit test `createSystemRevisionMessage` repository function: correct role, content, and metadata stored in DB
- [x] 9.2 Unit test `messageStore.addSystemRevisionMessage`: correct sequence_order computation, message appended to state, returns id
- [x] 9.3 Unit test `artifactStore._sealDraftInPlace`: `sysMsgCreator` called with correct revisionId and `'user'`; revision sealed with returned id
- [x] 9.4 Unit test `artifactStore._createSealedRevision`: `sysMsgCreator` called; new revision's `message_id` is system message id
- [x] 9.5 Unit test `artifactStore._reuseLastSealed` and `_reuseCurrentHead`: `sysMsgCreator` is never called
- [x] 9.6 Unit test `artifactStore.applyAiRevision`: `sysMsgCreator` called with `'ai'`; revision `message_id` set correctly
- [x] 9.7 Unit test `buildThread`: system messages with metadata appear in correct position; system messages without metadata are excluded; user/assistant messages pass through unchanged
- [x] 9.8 Component test `ArtifactRevisionCard`: renders artifact title from store, author label, timestamp; Load button calls `requestRevisionLoad`; shows "Loaded" when revision is active
- [x] 9.9 Integration test send flow: user sends with changed content → system message in DB → revision `message_id` = system message id → card visible in thread
- [x] 9.10 Integration test send flow: user sends without changes → no system message created
- [x] 9.11 Integration test AI revision: `handleAiArtifactResponse` → AI system message created → appears after assistant message in thread
- [x] 9.12 Integration test initial artifact: create conversation → 0 system messages; user first sends → exactly 1 system message created
