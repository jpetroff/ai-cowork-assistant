## Context

The app uses an artifact revision system where `ArtifactRevision.message_id` links a revision to its place in the chat timeline. Currently `message_id` points directly to the user/assistant message that triggered the revision — this coupling meant revisions and messages shared the same timeline anchor, but revisions had no independent visual card in the thread.

The thread is rendered by `buildThread(messages, revisions)` which merges both arrays by `created_at` and renders `RevisionCard` components for sealed revisions. The `messages` table today has `role IN ('user', 'assistant')` with no metadata column.

See `openspec/specs/project/artifact_revision_notes.md` for the canonical invariants that must be respected.

## Goals / Non-Goals

**Goals:**
- Every sealed revision appears as a compact card in the chat thread at the correct timeline position
- Cards show: artifact title (live), author label, timestamp, and a Load button
- The first revision card for a chat only appears after the user's first send (not on chat creation)
- `message_id` on revisions always points to a `system` message — one canonical source of truth for revision timeline placement
- Seal chain and AI response path both create system messages without direct cross-store imports

**Non-Goals:**
- Snapshotting artifact title at revision time (title is always current)
- Atomic DB transactions across system message creation + revision sealing (toast on failure is sufficient)
- Multiple artifacts per conversation (existing constraint: one artifact per conversation)
- Editing or deleting revision cards

## Decisions

### D1 — System messages as revision anchors (not inline revision rendering)

**Decision**: Each sealed revision owns a dedicated `system` role message. `buildThread` no longer merges revisions separately — system messages appear in the `messages` array and are rendered as artifact cards by `MessageList`.

**Alternatives considered**:
- Keep merging revisions in `buildThread` and just add a new card component → two parallel arrays stay coupled; sequence ordering remains fragile when revisions and messages share similar `created_at` values.
- Embed revision metadata in the user/assistant message (a `revisionId` field) → only works for user-triggered revisions, not AI-triggered ones which need their own card after the assistant message.

**Why this**: System messages are first-class timeline entries with proper `sequence_order`, eliminating the `created_at` tie-breaking problem. It also simplifies `buildThread` to a single-array sort.

---

### D2 — Lazy `sysMsgCreator` callback injected into seal chain

**Decision**: `sealForSend` and `applyAiRevision` accept a `sysMsgCreator: (revisionId: string, author: 'user' | 'ai') => Promise<string>` callback. The callback is called only in the paths that actually create a new revision (`_sealDraftInPlace`, `_createSealedRevision`, `applyAiRevision`). Reuse paths (`_reuseLastSealed`, `_reuseCurrentHead`) never call it.

**Alternatives considered**:
- `artifactStore` directly imports `messageStore` → tight cross-store coupling, violates existing architecture pattern.
- Component pre-checks `willCreateRevision` and creates the system message before calling `sealForSend` → duplicates seal-path decision logic.
- `sealForSend` returns revision ID, then caller creates system message, then caller calls `linkRevisionToMessage` → three-round-trip orchestration with a temporarily inconsistent state window.

**Why this**: Follows the `_flushRef` dependency-injection pattern already in the codebase. The artifact store stays agnostic of the message store. The callback is only invoked when a revision is genuinely created, keeping the reuse paths clean.

---

### D3 — `handleAiArtifactResponse` orchestrator in sidecarStore

**Decision**: Replace the inline `applyAiRevision(content, assistantMsgId)` call in `sidecarStore._dispatch` with a new `handleAiArtifactResponse(content, assistantMsgId)` method that orchestrates:
1. `messageStore.addSystemRevisionMessage('ai', revisionId)` (via the callback pattern)
2. `artifactStore.applyAiRevision(content, sysMsgCreator)`

**Why this**: The sidecarStore already imports both messageStore and artifactStore. Concentrating the orchestration here avoids introducing new cross-store coupling while keeping the AI response path symmetrical with the user send path (which is orchestrated in `ChatInput`).

---

### D4 — Backfill migration for existing sealed revisions

**Decision**: The v2 DB migration creates system messages for all existing sealed revisions (revisions where `message_id IS NOT NULL` and points to a user/assistant message). After migration, all sealed revisions point to system messages, and the old user/assistant message links are replaced.

**Alternatives considered**:
- Dual rendering: detect whether `message_id` points to a system message or user/assistant message, handle both cases → permanent dual code paths, complexity forever.
- No backfill: existing revisions lose their thread cards → bad UX for existing data.

**Why this**: Local SQLite app — single-user, no concurrent writers. A one-time backfill is low risk and results in a uniform data model going forward. Rollback is trivially the previous app build.

---

### D5 — Sequence ordering for system messages

**Decision**: System messages use `sequence_order = lastMessage.sequence_order + 1` at the moment of creation, computed from `messageStore.messages` state (which is kept in sync). The system message is appended to `messageStore.messages` before `finalizeStreaming` runs, ensuring assistant messages compute the correct next sequence number.

**Why this**: The existing `UNIQUE(conversation_id, sequence_order)` constraint enforces ordering. Relying on `created_at` alone would be fragile for messages created in the same millisecond. The messageStore state is authoritative for the next sequence number.

---

### D6 — Title is always live (not snapshotted)

**Decision**: `ArtifactRevisionCard` reads the artifact title from `useArtifactStore(s => s.artifact?.title)` at render time. No title is stored in system message metadata.

**Why this**: One artifact per conversation, so all cards in a thread refer to the same artifact. If the title changes, updating all cards is the desired behavior (user confirmed).

## Risks / Trade-offs

**[Risk] System message created but seal fails** → Revision stays as draft (`message_id = null`), system message orphaned in DB. The orphaned message appears as a card in the thread with no loadable revision.
→ Mitigation: Order operations as (1) seal/create revision first, (2) create system message. If step 2 fails, show toast — revision is sealed and usable, only the card is missing. The user can resend to trigger a new card.

**[Risk] `UNIQUE(conversation_id, sequence_order)` conflict** → If two operations race to insert with the same sequence_order (e.g., rapid sends), one will fail with a constraint error.
→ Mitigation: Input is disabled while streaming (`isStreaming === true`), so user sends are serialized. AI responses are triggered only after the assistant message finalizes. Concurrent inserts are not possible in normal flow.

**[Risk] Backfill migration corrupts existing data** → Inserting system messages between existing messages could produce wrong sequence_order values.
→ Mitigation: Backfill uses `created_at` ordering within each conversation, assigns new sequence_order values leaving gaps for the new system messages. Existing messages are renumbered. Since there's no external dependency on sequence_order values (only relative ordering matters), this is safe.

**[Trade-off] `buildThread` loses revision array** → Code that depended on `buildThread(messages, revisions)` must update. RevisionCard is replaced entirely.
→ Existing `RevisionCard` is replaced by `ArtifactRevisionCard` which reads from system message metadata. The Load button behavior is preserved.

## Migration Plan

1. Add migration v2 to `src-tauri/src/db.rs`:
   - Recreate `messages` table with `metadata TEXT` column and updated CHECK constraint
   - Backfill system messages for all existing sealed revisions
2. Update TypeScript types and repository layer
3. Update stores (messageStore, artifactStore, sidecarStore)
4. Update components (ChatInput, MessageList, new ArtifactRevisionCard)
5. Update revision-utils (`buildThread` signature)
6. Delete `RevisionCard.tsx`

**Rollback**: Revert to previous app build. The new system messages in the DB are harmless to old builds (they'll have unknown role and be filtered out by the old `buildThread` which never reads the messages table for revision display).

## Open Questions

- ~~Should the title be snapshotted?~~ Resolved: live title only.
- ~~Cross-store coupling for AI response path?~~ Resolved: `handleAiArtifactResponse` orchestrator.
- **Backfill sequence_order strategy**: When inserting system messages between existing messages during backfill, should existing messages be renumbered or should we use fractional/large gaps? → Renumber all messages in each conversation during migration (safe for local single-user DB).
