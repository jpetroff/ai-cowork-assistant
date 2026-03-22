## Context

The current `artifacts` table stores content inline and uses an integer `version` counter per conversation. There is no history — every update overwrites the previous content. The product requires a canvas-style document model where every significant change is preserved, users can browse revision history from the chat thread, and AI writes are always non-destructive. This change introduces `artifact_revisions` as the content layer, relegates `artifacts` to metadata, and adds copy-on-write semantics enforced in the store layer.

The app targets SQLite via Tauri plugin-sql. Development assumes a clean-slate database (no migration sequencing needed — v1 is always the full schema).

## Goals / Non-Goals

**Goals:**
- Every content change is preserved as an immutable `artifact_revisions` row once it is no longer HEAD
- AI can never silently overwrite user work (copy-on-write gate enforced before AI writes)
- Chat thread displays revision cards inline next to the messages that produced them
- Users can load any historical revision into the editor; editing it forks a new HEAD
- Send-time sealing preserves the exact artifact context that was submitted with a user message

**Non-Goals:**
- Diffing or merging revisions
- Conflict resolution (single-user app, no concurrency)
- Deleting individual revisions (cascade with artifact only)
- Branching (linear history per artifact)

## Decisions

### D1: Content lives entirely in `artifact_revisions`; `artifacts` is metadata only

**Decision:** Remove `content`, `version`, `last_author`, and `message_id` from `artifacts`. Add `current_revision_id` as a soft reference to the HEAD revision.

**Rationale:** Separating identity from content makes the revision model explicit at the schema level. An artifact with no revisions yet is a valid state (just created). `current_revision_id` is a soft reference (no FK constraint) to avoid a circular dependency: `artifacts → artifact_revisions → artifacts`.

**Alternative considered:** Keep content in `artifacts` and copy it into a snapshot table on change. Rejected because it duplicates content at every write and blurs which table is authoritative.

---

### D2: `conversations.active_artifact_id` tracks the open document

**Decision:** Add `active_artifact_id TEXT` (soft reference, no FK) to `conversations`. Updated whenever the user switches the active document.

**Rationale:** Multiple artifacts can exist in one conversation (canvas model). The conversation must remember which one is open so it survives navigation and app restart.

**Alternative considered:** Track active artifact in frontend state only. Rejected because it would lose state on restart.

---

### D3: In-place editing only when `HEAD.author == 'user' AND HEAD.message_id == null`

**Decision:** The store enforces an editing gate before every save. If HEAD fails the gate, a new `author='user'` revision is created (copy of HEAD content) before the first save proceeds.

**Rationale:** This rule means:
- Users can freely iterate on their own unsent drafts without creating revision noise
- AI-generated content is never modified in-place — always forked first
- Once a revision is sealed by a send (message_id set), subsequent edits start a clean draft

**Alternative considered:** Create a new revision on every save (no gate). Rejected — would produce thousands of revisions during normal typing.

---

### D4: Send-time sealing — set `message_id` on HEAD in-place; create new revision only if content changed since last sealed

**Decision:** When user submits a message with artifact attached:
1. If HEAD has no `message_id` → set `HEAD.message_id = user_message_id` in-place (seal it)
2. If HEAD already has a `message_id` AND content is identical to that sealed revision → reuse it, send `(revision_id, content)` as context; no new row
3. If HEAD already has a `message_id` AND content has changed → create a new `author='user'` revision with the new message_id, becomes HEAD

**Rationale:** The AI always receives a `(revision_id, content)` pair so it knows exactly what version the user was looking at. Avoid duplicate rows when user sends multiple messages without editing.

---

### D5: AI writes always create a new revision

**Decision:** When the AI produces content for an artifact, a new `author='ai'` revision is always inserted with `message_id = AI_message_id`, becoming the new HEAD. No in-place edit.

**Rationale:** Every AI response that touches the document is a distinct, attributable change. AI never satisfies the in-place gate (author must be 'user').

---

### D6: Revision cards in the chat thread via `message_id` join

**Decision:** Revisions with a non-null `message_id` are surfaced in the chat thread, rendered as `DocumentCard` components anchored to their linked message. Draft revisions (`message_id = null`) are accessible only via the revision picker on the document title bar.

**Rationale:** Matches the OpenCanvas UX where each AI response that touches the canvas shows a "canvas updated" card inline. User-send seals also appear ("you submitted this version"). Draft revisions have no thread position so hiding them from the thread is correct.

---

### D7: Non-HEAD revision editing creates a copy that becomes HEAD

**Decision:** If the user clicks a historical revision card and edits, the store creates a new `author='user'` revision with that revision's content as the starting point. The new revision becomes HEAD. The historical revision is unchanged.

**Rationale:** Linear history — there is always exactly one HEAD. Editing history forks forward, not backward.

## Risks / Trade-offs

- **Soft references can go stale** → `current_revision_id` or `active_artifact_id` may point to a deleted row. Mitigate: ON DELETE CASCADE on `artifact_revisions` ensures revisions are cleaned up with the artifact; store must handle null HEAD gracefully by creating a fresh revision.
- **Revision table grows unbounded** → For long conversations with heavy AI use, revision count could be large. Mitigate: acceptable for v1 (local SQLite, typical document sizes). Pruning can be added later.
- **Send-time content comparison is naive string equality** → Two revisions with identical whitespace differences would incorrectly be treated as different. Mitigate: trim before compare in store logic.

## Migration Plan

Development assumes clean slate — `src-tauri/src/db.rs` migration v1 is the only migration and is always run on a fresh database. No data migration needed. Production versioning strategy deferred.

## Open Questions

- Should artifact title changes (rename) create a new revision or update the artifact row only? (Recommendation: title lives on `artifacts` only, not versioned with content.)
- Frontend store architecture and revision history picker UI are out of scope for this change — deferred to follow-up.
