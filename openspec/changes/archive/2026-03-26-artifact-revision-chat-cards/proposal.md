## Why

Artifact revisions have no visible presence in the chat thread — when a user sends a document or the AI updates it, there is no card anchoring that event in the conversation timeline. Adding dedicated revision cards makes the document history legible alongside the conversation, without requiring users to open the revision picker to understand what changed and when.

## What Changes

- Every sealed artifact revision creates a `system` role message in the `messages` table that serves as its timeline anchor and thread card
- **BREAKING**: `ArtifactRevision.message_id` now always points to a `system` message (never directly to a `user` or `assistant` message)
- `messages` table gains a `metadata` column (nullable JSON) and extends `role` to include `'system'`
- `sealForSend` signature changes: takes a lazy `sysMsgCreator` callback instead of a `messageId` string
- `applyAiRevision` signature changes: takes a `sysMsgCreator` callback instead of a `messageId` string
- New `ArtifactRevisionCard` component renders system messages as compact two-line cards (title + author/timestamp) with a Load button
- `buildThread` simplified: no longer merges revisions separately — system messages carry revision identity via metadata
- Initial artifact creation (on new chat) does NOT create a system message; the card only appears after the first send
- Artifact title in cards is always the current live title (not snapshotted at revision time)
- Failed system message creation surfaces as a global toast error

## Capabilities

### New Capabilities
- `revision-chat-cards`: System-message-backed revision cards in the chat thread — creation, rendering, and Load interaction

### Modified Capabilities
- `artifact-revisions`: `message_id` invariant changes — now always points to a system message; seal chain and `applyAiRevision` signature updated
- `message-display`: Thread rendering updated to handle `system` role messages as artifact revision cards
- `database-schema`: `messages` table schema extended with `metadata` column and `'system'` role value

## Impact

- **Rust/SQLite**: New migration (v2) — recreate `messages` table with `metadata TEXT` column and updated `role` CHECK constraint
- **`src/lib/db/types.ts`**: `Message.role` union extended; `metadata` field added
- **`src/lib/db/repositories/messages.ts`**: New `createSystemRevisionMessage` function
- **`src/stores/messageStore.ts`**: New `addSystemRevisionMessage` action
- **`src/stores/artifactStore.ts`**: `sealForSend` and `applyAiRevision` signatures change; all four seal paths updated
- **`src/stores/sidecarStore.ts`**: New `handleAiArtifactResponse` orchestrator replaces inline `applyAiRevision` call
- **`src/components/chat/ChatInput.tsx`**: Updated send flow passes `sysMsgCreator` to `sealForSend`
- **`src/lib/revision-utils.ts`**: `buildThread` simplified — drops revision parameter
- **`src/components/chat/RevisionCard.tsx`**: Replaced by `ArtifactRevisionCard.tsx` driven by system message data
- **`src/components/chat/MessageList.tsx`**: Renders `ArtifactRevisionCard` for `role === 'system'` messages
- No new external dependencies
