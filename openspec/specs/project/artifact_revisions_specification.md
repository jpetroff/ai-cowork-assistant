# Feature Specification: Artifact Revisions

**Version:** 3.0
**Date:** 2026-03-23
**Status:** Draft
**Parent Spec:** SPEC.md v1.0
**Requirements Source:** REQUIREMENTS.md v1.1
**Feature Prompt:** prompt_for_feature_architect.md
**Lineage:** Corrected evolution of v2. Fixes two implementation bugs (stale revisionIdRef after draft creation, content swap during render). Retains v2's architecture: chain-of-responsibility, revision-ID staleness, contentSwapRequest signal, debounce in component.

---

## 1. Feature Summary

This feature introduces a revision system for artifacts. Instead of each AI response creating a separate artifact row (the current flat model in SPEC.md §5.4), a single artifact now owns an ordered chain of immutable revision snapshots. Only the HEAD revision is mutable (while it remains an unsent user draft). This enables seamless undo of AI changes, preserves context for chat history, and eliminates manual save/version actions.

**Core user value:** The user never thinks about saving. They can always revert to any prior state of their document — especially to undo unwanted AI modifications.

**Satisfies:** FR-EDT-008, FR-EDT-009, FR-CHT-004, FR-CHT-007, FR-CHT-008, BR-CHT-001, BR-CHT-002, NFR-003, NFR-011

---

## 2. Scope & Boundaries

### In Scope

- New DB schema: `artifacts` (metadata only) + `artifact_revisions` (all content)
- `conversations.active_artifact_id` column
- Revision lifecycle: in-place editing gate, seal-on-send, AI revision creation
- TipTap ↔ Zustand synchronization with stale-write prevention via revision ID tracking
- Editor content swap using `setContent` + `clearHistory` inside `useLayoutEffect`
- Revision history picker UI (title bar)
- Revision cards in chat thread (anchored to messages)
- Auto-save with debounce owned by editor component, not store

### Out of Scope

- Multiple artifacts per conversation (schema supports it; UI deferred)
- Side-by-side diff view between revisions
- AI change highlighting (FR-EDT-012, deferred per SPEC.md)
- Collaborative real-time editing (out of scope per REQUIREMENTS.md §1.3)

### Changes to Existing SPEC.md Modules

| Module | Change Type | Description |
|--------|-------------|-------------|
| `artifact.store.ts` (§5.4) | **Rewrite** | Chain-of-responsibility save/seal pattern, no timers, no editor reference |
| `EditorPanel.tsx` (§5.4.4) | **Rewrite** | Owns debounce, passes revisionId with content, processes swaps in useLayoutEffect |
| DB schema (§6.1) | **Migration** | Replace `artifacts` table, add `artifact_revisions`, alter `conversations` |
| `db.ts` (§6.3) | **Extend** | New typed helpers for revisions |
| `sidecar.store.ts` (§5.5.3) | **Modify** | `_dispatch` calls revised `applyAiRevision` |
| `message.store.ts` (§5.3) | **Minor** | Send includes artifact context |
| `ChatLayout.tsx` | **Modify** | Render revision cards in thread |
| `router.tsx` (§7.1) | **Modify** | Chat route loader loads revisions |

---

## 3. Design Principles

These principles override the general SPEC.md patterns where they conflict:

1. **Chain of responsibility, not conditionals.** Each store action performs one operation for one set of conditions. If its precondition fails, it delegates to the next function in the chain. No `if/else if/else` ladders. Every function in the chain is independently testable, commentable, and observable in a stack trace.

2. **Debounce is the editor's concern.** The Zustand store has zero timers. When the store's `save()` is called, it executes immediately and synchronously resolves which save variant to perform. The editor component owns the debounce timer and decides *when* to call save.

3. **Revision ID as staleness token.** Every `onChange` from the editor carries the revision ID that was loaded when editing began. The store's save chain validates this ID before writing. This eliminates the need for `isSwappingContent` guards — a stale revision ID is simply discarded.

4. **Explicit content swap requests.** The store never mutates the editor directly. When the store needs to change editor content (load, AI revision, revert), it sets a `contentSwapRequest` object. The component observes this via `useLayoutEffect`, performs the swap, and acknowledges it. One-way data flow, fully debuggable.

5. **No derived state.** `isDirty` is eliminated. The existence of a pending debounce timer in the editor IS the dirty state. The store doesn't duplicate it.

6. **Revision ID ref is always authoritative.** The editor component's `revisionIdRef` is the single source of truth for which revision the editor is currently editing. It is updated in exactly two places: (a) `useLayoutEffect` processing a `contentSwapRequest`, and (b) `useLayoutEffect` observing a `loadedRevisionId` change without a content swap (draft-creation case). No other code path may update this ref.

---

## 4. Data Model

### 4.1 Database Schema (Clean-Slate Migration)

```sql
-- Migration: replace artifacts table, add artifact_revisions, alter conversations

DROP TABLE IF EXISTS artifacts;

CREATE TABLE IF NOT EXISTS artifacts (
  id                  TEXT PRIMARY KEY,
  conversation_id     TEXT NOT NULL
                      REFERENCES conversations(id) ON DELETE CASCADE,
  title               TEXT,
  current_revision_id TEXT,          -- soft ref → artifact_revisions.id (no FK)
  file_path           TEXT,          -- relative to project folder [BR-EDT-003]
  file_hash           TEXT,          -- SHA-256 of last known disk content [FR-EDT-011]
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_art_conv ON artifacts(conversation_id);

CREATE TABLE IF NOT EXISTS artifact_revisions (
  id          TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL
              REFERENCES artifacts(id) ON DELETE CASCADE,
  message_id  TEXT
              REFERENCES messages(id) ON DELETE SET NULL,
  author      TEXT NOT NULL CHECK (author IN ('user', 'ai')),
  content     TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rev_artifact ON artifact_revisions(artifact_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rev_message ON artifact_revisions(message_id);

ALTER TABLE conversations ADD COLUMN active_artifact_id TEXT;
```

### 4.2 TypeScript Types

```typescript
// src/lib/types.ts

interface Artifact {
  id: string;
  conversationId: string;
  title: string | null;
  currentRevisionId: string | null;
  filePath: string | null;
  fileHash: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ArtifactRevision {
  id: string;
  artifactId: string;
  messageId: string | null;
  author: 'user' | 'ai';
  content: string;
  createdAt: number;
  updatedAt: number;
}

// Passed from editor to store on every save
interface SaveRequest {
  revisionId: string;   // the revision ID that was loaded when editing began
  content: string;      // current editor content (markdown)
}

// Set by store, consumed by editor component via useLayoutEffect
interface ContentSwapRequest {
  revisionId: string;
  content: string;
}

// Returned by sealForSend
interface SealResult {
  revisionId: string;
  content: string;
}
```

### 4.3 Pure Functions (no store dependency)

```typescript
// src/lib/revision-utils.ts

function canEditInPlace(head: ArtifactRevision | null): boolean {
  if (!head) return false;
  return head.author === 'user' && head.messageId === null;
}

function findLastSealedRevision(
  revisions: ArtifactRevision[]
): ArtifactRevision | null {
  for (let i = revisions.length - 1; i >= 0; i--) {
    if (revisions[i].messageId !== null) return revisions[i];
  }
  return null;
}

function hasContentChangedSinceLastSeal(
  headContent: string,
  revisions: ArtifactRevision[]
): boolean {
  const lastSealed = findLastSealedRevision(revisions);
  if (!lastSealed) return headContent.trim().length > 0;
  return headContent !== lastSealed.content;
}
```

### 4.4 Key Invariants

1. **One artifact per conversation** (this version). Schema supports multiple for future.
2. **HEAD = `artifact.currentRevisionId`**. Only HEAD's `content` and `updatedAt` may mutate.
3. **Non-HEAD revisions are immutable.**
4. **In-place editing requires:** `HEAD.author === 'user' AND HEAD.messageId === null`.
5. **`messageId` semantics:** `null` = draft; non-null = sealed (appears in chat thread).

---

## 5. Store Design

### 5.1 State — Minimal Surface

```typescript
// src/stores/artifact.store.ts

interface ArtifactState {
  artifact: Artifact | null;
  headRevision: ArtifactRevision | null;
  loadedRevisionId: string | null;       // which revision is displayed in editor
  revisions: ArtifactRevision[] | null;  // full history, sorted createdAt ASC

  contentSwapRequest: ContentSwapRequest | null;  // store → editor signal (content change)
  isSaving: boolean;
  saveError: string | null;
  externalChangeDetected: boolean;
}
```

**What is NOT in the store (and why):**
- `isDirty` — the editor's pending debounce timer IS the dirty state
- `isSwappingContent` — replaced by revision ID staleness check
- `editorInstance` — store never touches the editor; it sets `contentSwapRequest` instead
- `flushEditorSave` callback — replaced by `_flushRef` coordination pattern (§10.2)

### 5.2 Actions — Overview

```typescript
interface ArtifactActions {
  // --- Lifecycle ---
  loadForConversation: (conversationId: string) => Promise<void>;
  reset: () => void;

  // --- Save chain (called by editor after debounce) ---
  save: (request: SaveRequest) => Promise<void>;

  // --- Seal chain (called before sending message) ---
  sealForSend: (messageId: string) => Promise<SealResult | null>;

  // --- External triggers ---
  applyAiRevision: (content: string, messageId: string) => Promise<void>;
  requestRevisionLoad: (revisionId: string) => void;

  // --- Swap acknowledgment ---
  acknowledgeSwap: () => void;

  // --- File sync ---
  checkExternalChange: () => Promise<boolean>;
  reloadFromDisk: () => Promise<void>;
  linkToDisk: (relativePath: string) => Promise<void>;
}
```

---

## 6. Save Chain — Chain of Responsibility

When the editor's debounce timer fires, it calls `store.save({ revisionId, content })`. The save chain resolves synchronously which operation to perform, then executes it.

### 6.1 Chain Diagram

```
save(revisionId, content)
│
├─→ isStale(revisionId)?          → discard, return
│
├─→ isHeadAndEditable()?          → persistToHead(content)
│
├─→ isHeadButNotEditable()?       → createDraftThenPersist(content)
│
└─→ isNonHeadRevision()?          → createDraftFromOldRevision(revisionId, content)
```

Each function in the chain has exactly ONE precondition and ONE action. No function contains branching logic.

### 6.2 Implementation

```typescript
// --- Entry point ---

save: async ({ revisionId, content }: SaveRequest) => {
  // Chain link 1: stale check
  if (get().loadedRevisionId !== revisionId) return;
  // Stale save — editor was editing a revision that is no longer displayed.
  // This happens when a content swap occurred between the edit and the
  // debounce firing. The new revision's edits will trigger their own save.

  const { headRevision } = get();
  if (!headRevision) return;

  const isHead = revisionId === headRevision.id;

  if (isHead && canEditInPlace(headRevision)) {
    return get()._persistToHead(content);
  }

  if (isHead) {
    return get()._createDraftThenPersist(content);
  }

  return get()._createDraftFromOldRevision(content);
},
```

```typescript
// --- Chain link: persist content to current HEAD in place ---

_persistToHead: async (content: string) => {
  const { headRevision, artifact } = get();
  if (!headRevision || !artifact) return;

  set({ isSaving: true });

  try {
    await db.updateRevisionContent(headRevision.id, content);
    const now = Date.now();

    set({
      headRevision: { ...headRevision, content, updatedAt: now },
      revisions: get().revisions!.map(r =>
        r.id === headRevision.id ? { ...r, content, updatedAt: now } : r
      ),
      isSaving: false,
      saveError: null,
    });

    await get()._syncToDiskIfLinked(content);
  } catch (err) {
    set({ isSaving: false, saveError: String(err) });
  }
},
```

```typescript
// --- Chain link: HEAD exists but isn't editable → create draft, persist ---
// IMPORTANT: This sets loadedRevisionId to the new draft's ID.
// The editor component MUST observe this change (via useLayoutEffect on
// loadedRevisionId) and update its revisionIdRef to match. See §10.1.
// No contentSwapRequest is set because the editor already has the correct content.

_createDraftThenPersist: async (content: string) => {
  const { artifact, headRevision } = get();
  if (!artifact || !headRevision) return;

  set({ isSaving: true });

  try {
    const draft = await get()._createUserDraft(content);
    // loadedRevisionId changes here → editor's useLayoutEffect syncs revisionIdRef
    set({ loadedRevisionId: draft.id, isSaving: false, saveError: null });

    await get()._syncToDiskIfLinked(content);
  } catch (err) {
    set({ isSaving: false, saveError: String(err) });
  }
},
```

```typescript
// --- Chain link: editing a non-HEAD revision → create draft from it ---
// Same loadedRevisionId → revisionIdRef sync applies.

_createDraftFromOldRevision: async (content: string) => {
  const { artifact } = get();
  if (!artifact) return;

  set({ isSaving: true });

  try {
    const draft = await get()._createUserDraft(content);
    set({ loadedRevisionId: draft.id, isSaving: false, saveError: null });

    await get()._syncToDiskIfLinked(content);
  } catch (err) {
    set({ isSaving: false, saveError: String(err) });
  }
},
```

```typescript
// --- Shared: create a new user draft revision and set as HEAD ---

_createUserDraft: async (content: string): Promise<ArtifactRevision> => {
  const { artifact } = get();
  if (!artifact) throw new Error('No active artifact');

  const now = Date.now();
  const draft: ArtifactRevision = {
    id: generateId(),
    artifactId: artifact.id,
    messageId: null,
    author: 'user',
    content,
    createdAt: now,
    updatedAt: now,
  };

  await db.insertRevision(draft);
  await db.updateArtifactHead(artifact.id, draft.id);

  set({
    headRevision: draft,
    revisions: [...(get().revisions ?? []), draft],
    artifact: { ...artifact, currentRevisionId: draft.id, updatedAt: now },
  });

  return draft;
},
```

```typescript
// --- Shared: write to disk if artifact is linked to a file ---

_syncToDiskIfLinked: async (content: string) => {
  const { artifact } = get();
  if (!artifact?.filePath) return;

  const project = useProjectStore.getState().activeProject;
  if (!project) return;

  try {
    const absPath = `${project.folderPath}/${artifact.filePath}`;
    await invoke('write_file', { path: absPath, content });
    const hash = await invoke<string>('file_hash', { path: absPath });
    await db.updateArtifactFileHash(artifact.id, hash);
    set({ artifact: { ...get().artifact!, fileHash: hash } });
  } catch (err) {
    // [ERR-EDT-002] Disk write failed — DB save already succeeded, just warn
    set({ saveError: `Disk sync failed: ${String(err)}` });
  }
},
```

### 6.3 Save Chain Concurrency Guard

**Problem:** If two saves fire in rapid succession (e.g., debounce fires, then flush is called immediately), both could enter `_createDraftThenPersist` concurrently and each insert a new revision.

**Solution:** The save chain uses `isSaving` as a concurrency guard. The entry point checks and returns early:

```typescript
save: async ({ revisionId, content }: SaveRequest) => {
  if (get().loadedRevisionId !== revisionId) return;
  if (get().isSaving) return; // ← Prevents concurrent save chain execution

  const { headRevision } = get();
  if (!headRevision) return;

  // ... chain routing ...
},
```

This is safe because:
- `isSaving` is set to `true` at the start of every chain link
- If a flush fires while a debounced save is in-flight, the flush is discarded
- The debounced save already has the most recent content (debounce resets on each keystroke)
- If the flush has NEWER content than the in-flight save, the next `onUpdate` after typing resumes will trigger a new debounce cycle

---

## 7. Seal Chain — Chain of Responsibility

Called when the user sends a message. Resolves which seal variant to perform.

### 7.1 Flush-Before-Seal Protocol

The editor component exposes a `flushPendingSave()` function. Before calling `sealForSend`, the caller MUST flush:

```typescript
// In ChatInput or wherever send is triggered:
const handleSend = async (message: string) => {
  // Step 1: Flush editor's pending debounce — re-reads fresh content from editor
  editorFlushRef.current?.();

  // Step 2: Wait for any in-flight save to complete
  // (flush may have triggered a save that is now async)
  // The flush function is synchronous — it cancels the timer and calls save()
  // which is async but fire-and-forget. We need the save to complete before sealing.
  // Solution: flush returns a promise.
  await editorFlushRef.current?.();

  // Step 3: Seal the revision
  const msgId = generateId();
  const sealResult = await useArtifactStore.getState().sealForSend(msgId);

  // Step 4: Send to sidecar
  useSidecarStore.getState().sendChatRequest(message, sealResult);
};
```

`editorFlushRef` is a ref passed down from ChatPage (which renders both EditorPanel and ChatInput) or accessed via a lightweight context. EditorPanel sets this ref to its flush function on mount.

### 7.2 Chain Diagram

```
sealForSend(messageId)
│
├─→ isDraftAndChanged()?          → sealDraftInPlace(messageId)
│
├─→ isDraftAndUnchanged()?        → reuseLastSealed()
│
├─→ isSealedAndChanged()?         → createSealedRevision(messageId)
│
└─→ isSealedAndUnchanged()?       → reuseCurrentHead()
```

### 7.3 Implementation

```typescript
sealForSend: async (messageId: string): Promise<SealResult | null> => {
  const { headRevision, revisions } = get();
  if (!headRevision || !revisions) return null;

  const isDraft = headRevision.messageId === null;
  const changed = hasContentChangedSinceLastSeal(headRevision.content, revisions);

  if (isDraft && changed)    return get()._sealDraftInPlace(messageId);
  if (isDraft && !changed)   return get()._reuseLastSealed();
  if (!isDraft && changed)   return get()._createSealedRevision(messageId);
  /* !isDraft && !changed */  return get()._reuseCurrentHead();
},
```

```typescript
// --- Seal link: draft HEAD, content changed → seal it in place ---

_sealDraftInPlace: async (messageId: string): Promise<SealResult> => {
  const { headRevision } = get();
  const now = Date.now();

  await db.sealRevision(headRevision!.id, messageId);

  const sealed = { ...headRevision!, messageId, updatedAt: now };
  set({
    headRevision: sealed,
    revisions: get().revisions!.map(r => r.id === sealed.id ? sealed : r),
  });

  return { revisionId: sealed.id, content: sealed.content };
},
```

```typescript
// --- Seal link: draft HEAD, content unchanged → reuse last sealed ---

_reuseLastSealed: async (): Promise<SealResult | null> => {
  const { headRevision, revisions } = get();
  const lastSealed = findLastSealedRevision(revisions!);

  if (lastSealed) {
    return { revisionId: lastSealed.id, content: lastSealed.content };
  }

  // No sealed revision exists — send current HEAD as-is
  return { revisionId: headRevision!.id, content: headRevision!.content };
},
```

```typescript
// --- Seal link: HEAD already sealed, content changed → new sealed revision ---

_createSealedRevision: async (messageId: string): Promise<SealResult> => {
  const { artifact, headRevision } = get();
  const now = Date.now();

  const sealed: ArtifactRevision = {
    id: generateId(),
    artifactId: artifact!.id,
    messageId,
    author: 'user',
    content: headRevision!.content,
    createdAt: now,
    updatedAt: now,
  };

  await db.insertRevision(sealed);
  await db.updateArtifactHead(artifact!.id, sealed.id);

  set({
    headRevision: sealed,
    loadedRevisionId: sealed.id,
    revisions: [...get().revisions!, sealed],
    artifact: { ...get().artifact!, currentRevisionId: sealed.id, updatedAt: now },
  });

  return { revisionId: sealed.id, content: sealed.content };
},
```

```typescript
// --- Seal link: HEAD already sealed, content unchanged → reuse it ---

_reuseCurrentHead: async (): Promise<SealResult> => {
  const { headRevision } = get();
  return { revisionId: headRevision!.id, content: headRevision!.content };
},
```

---

## 8. Content Swap Protocol

The store never touches the editor DOM. Instead, it sets `contentSwapRequest`. The editor component observes this via `useLayoutEffect`, executes the swap, and acknowledges.

### 8.1 Store Side

```typescript
// Called by loadForConversation, applyAiRevision, requestRevisionLoad
_requestContentSwap: (revisionId: string, content: string) => {
  set({
    loadedRevisionId: revisionId,
    contentSwapRequest: { revisionId, content },
  });
},

acknowledgeSwap: () => {
  set({ contentSwapRequest: null });
},
```

### 8.2 Editor Component Side

The component detects `contentSwapRequest` inside a `useLayoutEffect` and performs the swap:

```typescript
// Inside EditorPanel (see §10.1 for full component):

const swapRequest = useArtifactStore(s => s.contentSwapRequest);
const acknowledgeSwap = useArtifactStore(s => s.acknowledgeSwap);

// ┌──────────────────────────────────────────────────────────────────────┐
// │ useLayoutEffect, NOT inline render.                                  │
// │                                                                      │
// │ v2 processed this inline during render, which violates React's rule  │
// │ that render must be pure. In Strict Mode or concurrent features,     │
// │ render runs twice, causing double setContent and double acknowledge.  │
// │                                                                      │
// │ useLayoutEffect runs after DOM commit but before paint. It runs      │
// │ exactly once per state change (even in Strict Mode, effects with     │
// │ cleanup are safe). The swap happens before the user sees the old     │
// │ content — no flicker.                                                │
// └──────────────────────────────────────────────────────────────────────┘
useLayoutEffect(() => {
  if (!swapRequest || !editor) return;

  // 1. Flush any pending save for the PREVIOUS document
  flushPendingSave();

  // 2. Swap content — emitUpdate: false suppresses onUpdate
  editor.commands.setContent(swapRequest.content, false);

  // 3. Clear undo/redo to prevent cross-document undo
  if (editor.can().clearHistory?.()) {
    editor.commands.clearHistory();
  }

  // 4. Update the editor's revision ID ref
  revisionIdRef.current = swapRequest.revisionId;

  // 5. Acknowledge — clears the request
  acknowledgeSwap();
}, [swapRequest, editor, flushPendingSave, acknowledgeSwap]);
```

### 8.3 Revision ID Ref Sync (the v2 fix)

**Problem identified in v2:** When `_createDraftThenPersist` creates a new draft, it updates `loadedRevisionId` in the store but does NOT set `contentSwapRequest` (because the editor already has the correct content). The editor's `revisionIdRef` remains stale. The next `onUpdate` sends the old revision ID → the save chain sees a mismatch → the save is silently discarded.

**v3 fix:** A second `useLayoutEffect` watches `loadedRevisionId` and syncs `revisionIdRef` whenever it changes outside of a content swap:

```typescript
const loadedRevisionId = useArtifactStore(s => s.loadedRevisionId);

// Sync revisionIdRef when store's loadedRevisionId changes without a content swap.
// This happens when _createDraftThenPersist or _createDraftFromOldRevision
// creates a new HEAD from the editor's current content — no swap needed,
// but the editor's ref must point to the new revision ID so subsequent
// saves are not discarded as stale.
useLayoutEffect(() => {
  if (loadedRevisionId && !swapRequest) {
    revisionIdRef.current = loadedRevisionId;
  }
}, [loadedRevisionId, swapRequest]);
```

**Why this is safe:**
- If `contentSwapRequest` is set at the same time as `loadedRevisionId` changes, the swap effect handles the ref update (§8.2 step 4). The `!swapRequest` guard prevents double-update.
- If `loadedRevisionId` changes without a swap (draft creation), this effect fires and syncs the ref.
- The ref update is in a `useLayoutEffect`, so it happens before the next `onUpdate` from the editor.

### 8.4 Why contentSwapRequest Instead of Direct Editor Access

| Concern | Direct editor access (v1) | contentSwapRequest (v3) |
|---------|---------------------------|--------------------------|
| Debugging | Store calls `editor.commands.setContent` — invisible in React DevTools | Store sets `contentSwapRequest` — visible as state, loggable |
| Race condition | Store may call setContent before component mounts (editor is null) | Request queues in state; component processes when ready |
| Stale save prevention | Requires `isSwappingContent` guard flag | Revision ID mismatch handles it; `flushPendingSave()` called explicitly |
| Testability | Must mock TipTap Editor object in store tests | Store tests check `contentSwapRequest` value — no editor mock needed |
| React data flow | Store → imperative DOM mutation (breaks unidirectional flow) | Store → state → useLayoutEffect → imperative DOM mutation (standard React) |
| React Strict Mode | Imperative call from store bypasses React lifecycle entirely | useLayoutEffect is Strict-Mode safe (cleanup + re-run) |

### 8.5 Stale Save Prevention — How It Works Without Guards

Scenario: AI revision arrives while editor has pending unsaved changes.

```
Timeline:

1. User edits document (revId=R1). Debounce timer running.
2. AI response arrives → store.applyAiRevision():
   a. Creates new revision R2, sets as HEAD
   b. Sets loadedRevisionId = R2
   c. Sets contentSwapRequest = { revisionId: R2, content: aiContent }
3. React commits DOM → useLayoutEffect fires:
   a. Sees contentSwapRequest
   b. Calls flushPendingSave() → save({ revisionId: R1, content: userEdits })
      → save checks: loadedRevisionId (R2) !== R1 → DISCARD (stale)
   c. Cancels debounce timer (flushPendingSave clears it)
   d. Calls setContent(aiContent, false)
   e. Sets revisionIdRef = R2
   f. Acknowledges swap
4. User types → onChange(R2, newContent) → debounce → save(R2, content)
   → R2 matches loadedRevisionId → enters chain → _createDraftThenPersist (R2 is AI-authored)
   → store updates loadedRevisionId to R3 (new draft)
   → useLayoutEffect syncs revisionIdRef = R3
5. User types again → onChange(R3, newContent) → debounce → save(R3, content)
   → R3 matches → _persistToHead (R3 is user draft, messageId null)
```

The stale save at step 3b is safely discarded. No guard flags. No special timing. The revision ID IS the guard.

---

## 9. Lifecycle Actions

### 9.1 loadForConversation

```typescript
loadForConversation: async (conversationId: string) => {
  get().reset();

  const artifact = await db.getArtifactForConversation(conversationId);

  if (!artifact) {
    // New conversation — create artifact + first empty revision
    const now = Date.now();
    const artifactId = generateId();
    const revisionId = generateId();

    const newArtifact: Artifact = {
      id: artifactId, conversationId, title: null,
      currentRevisionId: revisionId, filePath: null,
      fileHash: null, createdAt: now, updatedAt: now,
    };
    const firstRevision: ArtifactRevision = {
      id: revisionId, artifactId, messageId: null,
      author: 'user', content: '', createdAt: now, updatedAt: now,
    };

    await db.insertArtifact(newArtifact);
    await db.insertRevision(firstRevision);
    await db.setConversationActiveArtifact(conversationId, artifactId);

    set({
      artifact: newArtifact,
      headRevision: firstRevision,
      revisions: [firstRevision],
    });
    get()._requestContentSwap(revisionId, '');
    return;
  }

  const revisions = await db.getRevisionsForArtifact(artifact.id);
  const head = revisions.find(r => r.id === artifact.currentRevisionId) ?? null;

  set({ artifact, headRevision: head, revisions });
  get()._requestContentSwap(head?.id ?? '', head?.content ?? '');

  if (artifact.filePath) {
    await get().checkExternalChange();
  }
},
```

### 9.2 applyAiRevision

```typescript
applyAiRevision: async (content: string, messageId: string) => {
  const { artifact } = get();
  if (!artifact) return;

  const now = Date.now();
  const revision: ArtifactRevision = {
    id: generateId(),
    artifactId: artifact.id,
    messageId,
    author: 'ai',
    content,
    createdAt: now,
    updatedAt: now,
  };

  await db.insertRevision(revision);
  await db.updateArtifactHead(artifact.id, revision.id);

  set({
    headRevision: revision,
    revisions: [...(get().revisions ?? []), revision],
    artifact: { ...artifact, currentRevisionId: revision.id, updatedAt: now },
  });

  // Signal editor to swap content
  get()._requestContentSwap(revision.id, content);
},
```

### 9.3 requestRevisionLoad (Revision Picker)

```typescript
requestRevisionLoad: (revisionId: string) => {
  const revision = get().revisions?.find(r => r.id === revisionId);
  if (!revision) return;

  get()._requestContentSwap(revisionId, revision.content);
},
```

### 9.4 reset

```typescript
reset: () => {
  set({
    artifact: null,
    headRevision: null,
    loadedRevisionId: null,
    revisions: null,
    contentSwapRequest: null,
    isSaving: false,
    saveError: null,
    externalChangeDetected: false,
  });
},
```

---

## 10. Editor Component

### 10.1 EditorPanel — Complete Implementation

```typescript
// src/components/editor/EditorPanel.tsx

import { useRef, useCallback, useLayoutEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { useArtifactStore } from '@/stores/artifact.store';
import { TIPTAP_EXTENSIONS } from '@/lib/constants';
import { EditorToolbar } from './EditorToolbar';
import { RevisionPicker } from './RevisionPicker';

const DEBOUNCE_MS = 1000;

const EditorPanel: React.FC = () => {
  // --- Store selectors (primitives only for minimal re-renders) ---
  const isSaving = useArtifactStore(s => s.isSaving);
  const saveError = useArtifactStore(s => s.saveError);
  const swapRequest = useArtifactStore(s => s.contentSwapRequest);
  const acknowledgeSwap = useArtifactStore(s => s.acknowledgeSwap);
  const loadedRevisionId = useArtifactStore(s => s.loadedRevisionId);

  // --- Refs for debounce and revision tracking ---
  const revisionIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  // --- Flush: cancel timer, re-read fresh content from editor, save immediately ---
  // Returns a promise so callers can await the save completion.
  const flushPendingSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const currentRevisionId = revisionIdRef.current;
    const ed = editorRef.current;

    if (currentRevisionId && ed) {
      // Re-read fresh content from the editor, not from a stale ref.
      // This guarantees we capture the latest keystroke even if onUpdate
      // hasn't fired yet (e.g., user hit send in the same event loop tick).
      const freshContent = ed.storage.markdown.getMarkdown();
      await useArtifactStore.getState().save({
        revisionId: currentRevisionId,
        content: freshContent,
      });
    }
  }, []);

  // --- Editor instance ---
  const editor = useEditor({
    extensions: TIPTAP_EXTENSIONS,
    content: '',
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed;
    },
    onDestroy: () => {
      editorRef.current = null;
    },
    onUpdate: ({ editor: ed }) => {
      const revisionId = revisionIdRef.current;
      if (!revisionId) return;

      const content = ed.storage.markdown.getMarkdown();

      // Reset debounce timer
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        useArtifactStore.getState().save({ revisionId, content });
      }, DEBOUNCE_MS);
    },
  });

  // Keep editorRef in sync (useEditor may return a new instance)
  editorRef.current = editor;

  // --- Content swap: process store's request via useLayoutEffect ---
  // useLayoutEffect, not inline render. Runs after DOM commit, before paint.
  // Strict Mode safe. No flicker.
  useLayoutEffect(() => {
    if (!swapRequest || !editor) return;

    // Flush pending save for PREVIOUS document (stale save will be discarded by chain)
    // Fire-and-forget: the save chain handles staleness internally.
    const prevRevisionId = revisionIdRef.current;
    if (prevRevisionId && debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      // Don't await — the stale check in save() will discard this anyway
      // since loadedRevisionId has already changed.
    }

    // Swap content — emitUpdate: false suppresses onUpdate
    editor.commands.setContent(swapRequest.content, false);

    // Clear undo/redo to prevent cross-document undo
    if (editor.can().clearHistory?.()) {
      editor.commands.clearHistory();
    }

    // Update the editor's revision ID ref
    revisionIdRef.current = swapRequest.revisionId;

    // Acknowledge — clears the request
    acknowledgeSwap();
  }, [swapRequest, editor, acknowledgeSwap]);

  // --- Revision ID ref sync (v3 fix for draft creation without content swap) ---
  // When _createDraftThenPersist updates loadedRevisionId without setting
  // contentSwapRequest, the editor's revisionIdRef must be synced so subsequent
  // saves carry the correct ID and are not discarded as stale.
  useLayoutEffect(() => {
    if (loadedRevisionId && !swapRequest) {
      revisionIdRef.current = loadedRevisionId;
    }
  }, [loadedRevisionId, swapRequest]);

  // --- Expose flush to parent (for seal-before-send) ---
  const flushRef = useArtifactStore(s => s._flushRef);
  if (flushRef) flushRef.current = flushPendingSave;

  // --- Cleanup debounce timer on unmount ---
  useLayoutEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="editor-panel flex flex-col h-full">
      <div className="editor-header flex items-center justify-between px-3 py-2 border-b">
        <RevisionPicker />
        <div className="flex items-center gap-2 text-sm text-muted">
          {isSaving && <span>Saving...</span>}
          {saveError && <span className="text-destructive">Save failed</span>}
        </div>
      </div>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className="editor-content flex-1 overflow-auto" />
    </div>
  );
};
```

### 10.2 Flush Ref Pattern

The store holds a ref that EditorPanel writes its flush function into. This avoids callback registration boilerplate while keeping the store timer-free.

```typescript
// In artifact.store.ts initial state:
_flushRef: { current: null as (() => Promise<void>) | null },
```

This is a plain mutable object, not Zustand state — it doesn't trigger re-renders. It's a coordination mechanism, like a context ref.

**Usage in ChatInput:**

```typescript
// ChatInput or the send handler:
const handleSend = async (message: string) => {
  const artStore = useArtifactStore.getState();

  // Flush editor debounce — re-reads fresh content from editor
  await artStore._flushRef.current?.();

  // Seal
  const msgId = generateId();
  const sealResult = await artStore.sealForSend(msgId);

  // Send
  useSidecarStore.getState().sendChatRequest(message, sealResult);
};
```

**Why `flushPendingSave` re-reads from the editor (v3 improvement over v2):**

v2's `flushPendingSave` used `pendingSaveRef.current` — content captured at the last `onUpdate`. If the user types a character and immediately hits send within the same event loop tick, `onUpdate` may not have fired yet, so the captured content is stale. v3's flush reads `editor.storage.markdown.getMarkdown()` directly, guaranteeing the latest content.

### 10.3 "Unsaved" Indicator

v2 used `pendingSaveRef.current` in JSX, which is a ref and doesn't trigger re-renders. v3 removes the unreliable "Unsaved" label from the default implementation. If a real-time unsaved indicator is needed, add a local `useState<boolean>` toggled by `onUpdate` (set true) and save completion (set false via a subscription). This is a UI enhancement, not a correctness concern.

---

## 11. Event Table — Complete

| # | Event | Store action | New revision? | contentSwapRequest? |
|---|-------|-------------|---------------|---------------------|
| E1 | New conversation | `loadForConversation` | Yes (first, empty) | Yes |
| E2 | User types, HEAD is editable draft | `save` → `_persistToHead` | No | No |
| E3 | User types, HEAD is AI-authored | `save` → `_createDraftThenPersist` | Yes | No (editor has content; revisionIdRef synced via useLayoutEffect) |
| E4 | User types, HEAD is sealed | `save` → `_createDraftThenPersist` | Yes | No (same as E3) |
| E5 | User types while viewing old revision | `save` → `_createDraftFromOldRevision` | Yes | No (same as E3) |
| E6 | Send message, draft HEAD, changed | `sealForSend` → `_sealDraftInPlace` | No (seal in place) | No |
| E7 | Send message, draft HEAD, unchanged | `sealForSend` → `_reuseLastSealed` | No | No |
| E8 | Send message, sealed HEAD, changed | `sealForSend` → `_createSealedRevision` | Yes | No |
| E9 | Send message, sealed HEAD, unchanged | `sealForSend` → `_reuseCurrentHead` | No | No |
| E10 | AI modifies artifact | `applyAiRevision` | Yes | Yes |
| E11 | User selects old revision in picker | `requestRevisionLoad` | No | Yes |
| E12 | User switches conversations | `loadForConversation` (new) | — | Yes |

Note: `contentSwapRequest` is only set when the STORE decides the editor must show different content. When the editor originates the change (E2–E5), no swap is needed — only the `revisionIdRef` sync via `useLayoutEffect` fires.

---

## 12. Chat Integration

### 12.1 Updated sendChatRequest

```typescript
// src/stores/sidecar.store.ts

sendChatRequest: (userMessage: string, sealResult: SealResult | null) => {
  const project = useProjectStore.getState().activeProject;
  const messages = useMessageStore.getState().messagesForActiveConversation;
  const artifact = useArtifactStore.getState().artifact;

  const request: ChatCompletionRequest = {
    message: userMessage,
    chatHistory: messages.map(m => ({ role: m.role, content: m.content })),
    workingFolder: project?.folderPath ?? undefined,
    knowledgeHubs: project ? [`project-${project.id}`] : undefined,
    ...(sealResult && artifact && {
      artifact: {
        artifactId: artifact.id,
        revisionId: sealResult.revisionId,
        content: sealResult.content,
      },
    }),
  };

  _ws?.send(JSON.stringify(request));
},
```

### 12.2 Updated _dispatch

```typescript
case 'completion.response':
  msgStore.finalizeMessage(convId, String(msg.content ?? ''));
  if (msg.payload?.artifact) {
    artStore.applyAiRevision(
      msg.payload.artifact.content,
      msg.payload.messageId
    );
  }
  break;
```

### 12.3 Thread Display

Chat thread renders two item types merged in chronological order:

1. **Messages** — user and AI messages (existing)
2. **Revision cards** — only revisions where `message_id IS NOT NULL`

```typescript
// In MessageList.tsx or ChatLayout.tsx

interface ThreadItem {
  type: 'message' | 'revision-card';
  timestamp: number;
  message?: Message;
  revision?: ArtifactRevision;
}

function buildThread(
  messages: Message[],
  revisions: ArtifactRevision[]
): ThreadItem[] {
  const items: ThreadItem[] = [];

  messages.forEach(m => items.push({
    type: 'message',
    timestamp: m.createdAt,
    message: m,
  }));

  revisions
    .filter(r => r.messageId !== null)
    .forEach(r => items.push({
      type: 'revision-card',
      timestamp: r.createdAt,
      revision: r,
    }));

  return items.sort((a, b) => a.timestamp - b.timestamp);
}
```

**Revision card component:**

```typescript
// src/components/chat/RevisionCard.tsx

interface RevisionCardProps {
  revision: ArtifactRevision;
  onLoad: (revisionId: string) => void;
}

const RevisionCard: React.FC<RevisionCardProps> = ({ revision, onLoad }) => {
  const label = revision.author === 'ai'
    ? 'AI updated the document'
    : 'You sent this document version';

  return (
    <button
      onClick={() => onLoad(revision.id)}
      className="revision-card w-full text-left p-3 rounded-lg border bg-muted/30
                 hover:bg-muted/50 transition-colors cursor-pointer"
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground mt-1">
        {formatDate(revision.createdAt)}
      </div>
    </button>
  );
};
```

---

## 13. Revision History Picker

Located in the editor's title bar. Shows all revisions (including drafts) for the active artifact.

```typescript
// src/components/editor/RevisionPicker.tsx

import { useArtifactStore } from '@/stores/artifact.store';
import { useShallow } from 'zustand/react/shallow';

const RevisionPicker: React.FC = () => {
  const { revisions, loadedRevisionId, headRevision, requestRevisionLoad } =
    useArtifactStore(useShallow(s => ({
      revisions: s.revisions,
      loadedRevisionId: s.loadedRevisionId,
      headRevision: s.headRevision,
      requestRevisionLoad: s.requestRevisionLoad,
    })));

  if (!revisions || revisions.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="text-sm text-muted-foreground hover:text-foreground">
        Version {revisions.findIndex(r => r.id === loadedRevisionId) + 1} of {revisions.length}
        {loadedRevisionId !== headRevision?.id && ' (viewing past version)'}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {revisions.map((rev, idx) => (
          <DropdownMenuItem
            key={rev.id}
            onClick={() => requestRevisionLoad(rev.id)}
            className={rev.id === loadedRevisionId ? 'bg-accent' : ''}
          >
            <div>
              <span className="font-medium">v{idx + 1}</span>
              <span className="ml-2 text-muted-foreground">
                {rev.author === 'ai' ? 'AI' : 'You'}
                {rev.messageId === null ? ' (draft)' : ''}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDate(rev.createdAt)}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

---

## 14. Route Loader

```typescript
{
  path: '/projects/:projectId/chats/:chatId',
  loader: async ({ params }) => {
    useConversationStore.getState().setActive(params.chatId!);
    await useMessageStore.getState().loadForConversation(params.chatId!);
    await useArtifactStore.getState().loadForConversation(params.chatId!);
    return null;
  },
  element: <ChatPage />,
},
```

---

## 15. Database Helpers

```typescript
// src/lib/db.ts — additions

export const db = {
  // ... existing helpers ...

  // Artifacts (metadata only)
  getArtifactForConversation: async (conversationId: string): Promise<Artifact | null> => {
    const rows = await (await getDb()).select<Artifact[]>(
      'SELECT * FROM artifacts WHERE conversation_id = ? LIMIT 1',
      [conversationId]
    );
    return rows[0] ? mapArtifactRow(rows[0]) : null;
  },

  insertArtifact: async (a: Artifact) => {
    await (await getDb()).execute(
      `INSERT INTO artifacts (id, conversation_id, title, current_revision_id,
       file_path, file_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.conversationId, a.title, a.currentRevisionId,
       a.filePath, a.fileHash, a.createdAt, a.updatedAt]
    );
  },

  updateArtifactHead: async (artifactId: string, revisionId: string) => {
    await (await getDb()).execute(
      'UPDATE artifacts SET current_revision_id = ?, updated_at = ? WHERE id = ?',
      [revisionId, Date.now(), artifactId]
    );
  },

  updateArtifactFileHash: async (artifactId: string, hash: string) => {
    await (await getDb()).execute(
      'UPDATE artifacts SET file_hash = ? WHERE id = ?',
      [hash, artifactId]
    );
  },

  setConversationActiveArtifact: async (conversationId: string, artifactId: string) => {
    await (await getDb()).execute(
      'UPDATE conversations SET active_artifact_id = ? WHERE id = ?',
      [artifactId, conversationId]
    );
  },

  // Revisions
  getRevisionsForArtifact: async (artifactId: string): Promise<ArtifactRevision[]> => {
    const rows = await (await getDb()).select<ArtifactRevision[]>(
      'SELECT * FROM artifact_revisions WHERE artifact_id = ? ORDER BY created_at ASC',
      [artifactId]
    );
    return rows.map(mapRevisionRow);
  },

  insertRevision: async (r: ArtifactRevision) => {
    await (await getDb()).execute(
      `INSERT INTO artifact_revisions (id, artifact_id, message_id, author, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.artifactId, r.messageId, r.author, r.content, r.createdAt, r.updatedAt]
    );
  },

  updateRevisionContent: async (revisionId: string, content: string) => {
    await (await getDb()).execute(
      'UPDATE artifact_revisions SET content = ?, updated_at = ? WHERE id = ?',
      [content, Date.now(), revisionId]
    );
  },

  sealRevision: async (revisionId: string, messageId: string) => {
    await (await getDb()).execute(
      'UPDATE artifact_revisions SET message_id = ?, updated_at = ? WHERE id = ?',
      [messageId, Date.now(), revisionId]
    );
  },
};

// Row mappers (DB returns snake_case, TypeScript uses camelCase)
function mapArtifactRow(row: any): Artifact {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    title: row.title,
    currentRevisionId: row.current_revision_id,
    filePath: row.file_path,
    fileHash: row.file_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRevisionRow(row: any): ArtifactRevision {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    messageId: row.message_id,
    author: row.author,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

---

## 16. Edge Cases

| # | Scenario | Behavior |
|---|----------|----------|
| EC-1 | User types rapidly, debounce hasn't fired | Debounce resets each keystroke. One save fires 1s after last keystroke. |
| EC-2 | Content swap while debounce pending | `useLayoutEffect` flushes the pending timer (clears it), swaps content. Old save timer is gone. New edits start fresh debounce. |
| EC-3 | Save creates new draft (E3/E4/E5) → store updates `loadedRevisionId` | `useLayoutEffect` on `loadedRevisionId` syncs `revisionIdRef`. No content swap needed. Next `onUpdate` carries the correct new revision ID. |
| EC-4 | EditorPanel not mounted when `contentSwapRequest` is set | Request waits in store state. When EditorPanel mounts and `useLayoutEffect` runs, it processes the request. |
| EC-5 | App crashes during debounce | Pending content lost (max 1s of edits). SQLite WAL ensures all committed writes are durable. |
| EC-6 | User clicks send while typing | `flushPendingSave()` called by send handler → re-reads fresh content from editor → save executes → then `sealForSend` proceeds with up-to-date content. |
| EC-7 | `setContent(content, false)` fires onUpdate anyway (TipTap edge case) | The onUpdate → debounce → save chain fires with the SAME revision ID and SAME content that was just loaded. Save → `_persistToHead` writes identical content to DB. Harmless no-op (idempotent). |
| EC-8 | `setContent(content, false)` fires onUpdate with EMPTY content (worst case) | Debounce starts with empty content. If user types within 1s, debounce resets with correct content. If user doesn't type for 1s, save fires with empty content. **Mitigation:** the content swap `useLayoutEffect` already cleared `revisionIdRef` and re-set it — `onUpdate` would carry the new ID and empty content. The save chain writes empty string to HEAD. This is the same edge case as v2 (TipTap issue #1715, fixed). If it manifests in testing, add a content-length guard in `onUpdate`: `if (content === '' && revisionIdRef.current === swapRequest?.revisionId) return`. |
| EC-9 | React Strict Mode double-renders | `useLayoutEffect` with proper deps runs once per state change in production. In Strict Mode, the cleanup (timer clearance) runs first, then the effect re-runs. The swap is idempotent — calling `setContent` twice with the same content is harmless. `acknowledgeSwap` is also idempotent (sets `null` to `null` on second call). |
| EC-10 | Two saves enter `_createDraftThenPersist` concurrently | `isSaving` guard at save entry point (§6.3) prevents concurrent chain execution. Second save is discarded. Next debounce cycle retries. |
| EC-11 | `flushPendingSave` called when `isSaving` is true from a debounced save | Flush re-reads content from editor and calls `save()`. Save entry point sees `isSaving === true` → returns early. The in-flight save already has recent content (from the debounce). After it completes and sets `isSaving = false`, `sealForSend` proceeds with the saved content. |

---

## 17. Error Handling

| Error | Source | Handling | Satisfies |
|-------|--------|----------|-----------|
| DB write failure in save chain | `_persistToHead`, `_createUserDraft` | Set `saveError`. UI shows warning. Next debounce retries. | ERR-EDT-001 |
| DB write failure in seal chain | `_sealDraftInPlace`, `_createSealedRevision` | Returns null. Message sent without artifact context. Toast warning. | ERR-CHT-002 |
| Disk write failure | `_syncToDiskIfLinked` | Set `saveError` with "Disk sync failed" prefix. DB save already succeeded. | ERR-EDT-002 |

---

## 18. Testing Strategy

### 18.1 Unit Tests — Store

**File:** `src/stores/__tests__/artifact.store.test.ts`

**Save chain tests (one per chain link):**

| Test | Input | Expected chain link | Assertion |
|------|-------|---------------------|-----------|
| Stale revision ID | `save({ revisionId: 'old', content })` where `loadedRevisionId !== 'old'` | Discard | No DB write, no state change |
| Concurrent save guard | `save()` while `isSaving === true` | Discard | No DB write, no state change |
| HEAD, editable draft | `save({ revisionId: head.id, content })` where `canEditInPlace(head)` | `_persistToHead` | DB `updateRevisionContent` called, head content updated |
| HEAD, AI-authored | Same, `head.author === 'ai'` | `_createDraftThenPersist` | DB `insertRevision` + `updateArtifactHead`, new HEAD in state, `loadedRevisionId` updated |
| HEAD, sealed | Same, `head.messageId !== null` | `_createDraftThenPersist` | Same as above |
| Non-HEAD revision | `save({ revisionId: oldRev.id, content })` where `oldRev.id !== head.id` | `_createDraftFromOldRevision` | New draft created from old revision |

**Seal chain tests (one per link):**

| Test | Precondition | Expected link | Assertion |
|------|-------------|---------------|-----------|
| Draft, changed | `head.messageId === null`, content differs | `_sealDraftInPlace` | DB `sealRevision`, head.messageId set |
| Draft, unchanged | Same, content matches last sealed | `_reuseLastSealed` | No DB write, returns last sealed |
| Sealed, changed | `head.messageId !== null`, content differs | `_createSealedRevision` | New sealed revision in DB |
| Sealed, unchanged | Same, content matches | `_reuseCurrentHead` | No DB write, returns head |

**Lifecycle tests:**
- `loadForConversation` — new conversation → creates artifact + revision, sets contentSwapRequest
- `loadForConversation` — existing → loads from DB, sets contentSwapRequest
- `applyAiRevision` → creates revision, sets contentSwapRequest
- `requestRevisionLoad` → sets contentSwapRequest
- `acknowledgeSwap` → clears contentSwapRequest

**No TipTap mocking needed in store tests.** The store never touches the editor. Tests only assert on state and DB call arguments.

### 18.2 Component Tests

**File:** `src/components/editor/__tests__/EditorPanel.test.tsx`

- Content swap: set `contentSwapRequest` in store → render → assert `useLayoutEffect` called `setContent` on editor → assert `acknowledgeSwap` called
- Debounce: simulate `onUpdate` → assert no immediate `save` call → advance timer by 1s → assert `save` called with correct `{ revisionId, content }`
- Flush: trigger `flushPendingSave` → assert immediate `save` call with fresh content from editor → timer cleared
- Revision ID ref sync: set `loadedRevisionId` in store without `contentSwapRequest` → assert next `onUpdate` carries the new revision ID
- Strict Mode: verify content swap `useLayoutEffect` is idempotent when run twice

### 18.3 Integration & E2E

**DB integration tests** (`tests/integration/db/revisions.test.ts`):
- Insert artifact → insert revisions → query returns correct order
- `updateArtifactHead` changes `current_revision_id`
- `sealRevision` sets `message_id`
- `updateRevisionContent` changes content and `updated_at`
- CASCADE: delete conversation → artifact + revisions deleted
- `ON DELETE SET NULL`: delete message → revision.message_id set to null

**E2E tests** (`tests/e2e/flows/revisions.test.ts`):

| Flow | Steps |
|------|-------|
| Auto-save revision | Type in editor → wait 1.5s → check DB for updated HEAD content |
| AI revision cycle | Type → send message → receive AI response → editor shows AI content → type again → new revision created |
| Revision picker revert | Create multiple revisions → open picker → select old version → editor shows old content → type → new HEAD created |
| Seal on send | Type in editor → send message → HEAD.message_id is set → type again → new revision created |

---

## 19. Implementation Plan

### Phase 1: Schema & Utilities

| # | Task | Files | Deps |
|---|------|-------|------|
| 1 | DB migration | `commands/db.rs` | — |
| 2 | TypeScript types: Artifact, ArtifactRevision, SaveRequest, ContentSwapRequest, SealResult | `src/lib/types.ts` | — |
| 3 | Pure functions: canEditInPlace, findLastSealedRevision, hasContentChangedSinceLastSeal | `src/lib/revision-utils.ts` | 2 |
| 4 | DB helpers: all revision CRUD + row mappers | `src/lib/db.ts` | 1 |

### Phase 2: Store — Data Actions

| # | Task | Files | Deps |
|---|------|-------|------|
| 5 | Store skeleton: state, initial state, reset, _requestContentSwap, acknowledgeSwap, _flushRef | `src/stores/artifact.store.ts` | 2 |
| 6 | loadForConversation | `src/stores/artifact.store.ts` | 4, 5 |
| 7 | _createUserDraft (shared helper) | `src/stores/artifact.store.ts` | 4, 5 |

### Phase 3: Store — Save Chain

| # | Task | Files | Deps |
|---|------|-------|------|
| 8 | save (entry point + stale check + isSaving guard) | `src/stores/artifact.store.ts` | 3, 5 |
| 9 | _persistToHead | `src/stores/artifact.store.ts` | 4, 5 |
| 10 | _createDraftThenPersist | `src/stores/artifact.store.ts` | 7, 5 |
| 11 | _createDraftFromOldRevision | `src/stores/artifact.store.ts` | 7, 5 |
| 12 | _syncToDiskIfLinked | `src/stores/artifact.store.ts` | 4 |

### Phase 4: Store — Seal Chain

| # | Task | Files | Deps |
|---|------|-------|------|
| 13 | sealForSend (entry + routing) | `src/stores/artifact.store.ts` | 3, 5 |
| 14 | _sealDraftInPlace | `src/stores/artifact.store.ts` | 4 |
| 15 | _reuseLastSealed | `src/stores/artifact.store.ts` | 3 |
| 16 | _createSealedRevision | `src/stores/artifact.store.ts` | 4, 7 |
| 17 | _reuseCurrentHead | `src/stores/artifact.store.ts` | — |

### Phase 5: Store — External Triggers

| # | Task | Files | Deps |
|---|------|-------|------|
| 18 | applyAiRevision | `src/stores/artifact.store.ts` | 4, 5 |
| 19 | requestRevisionLoad | `src/stores/artifact.store.ts` | 5 |

### Phase 6: Editor Component

| # | Task | Files | Deps |
|---|------|-------|------|
| 20 | EditorPanel rewrite: useEditor with onUpdate/onCreate/onDestroy, debounce via refs, useLayoutEffect for content swap, useLayoutEffect for revisionIdRef sync, flush function with fresh editor read, cleanup on unmount | `src/components/editor/EditorPanel.tsx` | 5, 8 |
| 21 | Flush ref pattern: _flushRef in store, async flush usage in send handler | `src/stores/artifact.store.ts`, ChatInput area | 20 |

### Phase 7: Chat Integration

| # | Task | Files | Deps |
|---|------|-------|------|
| 22 | Update sendChatRequest to accept SealResult, include artifact context | `src/stores/sidecar.store.ts` | 13 |
| 23 | Update _dispatch for applyAiRevision | `src/stores/sidecar.store.ts` | 18 |
| 24 | RevisionCard component + thread builder | `src/components/chat/RevisionCard.tsx`, ChatLayout | 6 |
| 25 | RevisionPicker dropdown | `src/components/editor/RevisionPicker.tsx` | 19 |
| 26 | Update chat route loader | `src/router.tsx` | 6 |

### Phase 8: File Sync

| # | Task | Files | Deps |
|---|------|-------|------|
| 27 | checkExternalChange, reloadFromDisk, linkToDisk | `src/stores/artifact.store.ts` | 4, 5, 12 |

### Phase 9: Tests

| # | Task | Files | Deps |
|---|------|-------|------|
| 28 | Pure function tests | `src/lib/__tests__/revision-utils.test.ts` | 3 |
| 29 | Save chain unit tests (6 tests, including concurrency guard) | `src/stores/__tests__/artifact.store.test.ts` | 8–11 |
| 30 | Seal chain unit tests (4 tests) | Same file | 13–17 |
| 31 | Lifecycle unit tests | Same file | 6, 18, 19 |
| 32 | EditorPanel component tests (including revisionIdRef sync and Strict Mode) | `src/components/editor/__tests__/EditorPanel.test.tsx` | 20 |
| 33 | DB integration tests | `tests/integration/db/revisions.test.ts` | 4 |
| 34 | E2E tests | `tests/e2e/flows/revisions.test.ts` | All |

---

## 20. Requirement Traceability

| Requirement ID | Spec Section | Status |
|----------------|-------------|--------|
| FR-EDT-008 | §6, §10.1 | Covered — debounced auto-save via editor component + save chain |
| FR-EDT-009 | §9.3, §13 | Covered — revision picker loads content via requestRevisionLoad |
| FR-EDT-010 | §6.2 | Covered — _syncToDiskIfLinked called after every successful save |
| FR-EDT-011 | Phase 8 | Covered — checkExternalChange on conversation load |
| FR-CHT-004 | §9.1 | Covered — new conversation creates empty artifact + revision |
| FR-CHT-007 | §14 | Covered — route loader restores full state |
| FR-CHT-008 | §9.2, §12.3 | Covered — AI revision linked to message, shown in thread |
| BR-CHT-001 | §11 E10 | Covered — AI creates new revision, previous accessible |
| BR-CHT-002 | §12.1 | Covered — sealed content sent as context |
| BR-EDT-001 | §10.1 | Covered — debounce is non-blocking |
| NFR-003 | §10.1, §6 | Covered — save is asynchronous, never blocks UI |
| NFR-011 | §16 EC-5 | Covered — SQLite WAL mode |

---

## 21. ADRs

### ADR-REV-001: Chain of responsibility over conditional branching

- **Context:** v1 save logic used nested if/else with guard flags. Debugging required understanding the full conditional tree.
- **Decision:** Each save/seal variant is a separate named function with one precondition. Entry point resolves which function to call. Stack trace immediately shows which variant executed.
- **Consequences:** More functions, but each is trivially testable. Adding a new save variant = adding one function + one condition in the entry point.

### ADR-REV-002: Debounce in editor component, not Zustand store

- **Context:** v1 had a module-level `setTimeout` in the store. This was invisible to React DevTools, couldn't be cleared on unmount, and mixed timing concerns with state logic.
- **Decision:** Editor component owns the debounce timer via refs. Store actions execute immediately when called. The component decides *when* to call them.
- **Consequences:** Store is fully synchronous (except DB writes). Component is the only place with timing behavior. `flushPendingSave()` is a component function exposed via `_flushRef`.

### ADR-REV-003: contentSwapRequest signal over direct editor access

- **Context:** v1 store held `editorInstance` and called `editor.commands.setContent()` directly. This was an imperative mutation from outside React, invisible in DevTools, and could race with component lifecycle.
- **Decision:** Store sets `contentSwapRequest` in state. Component processes it in `useLayoutEffect`. Store never references the editor.
- **Consequences:** Store tests don't need a TipTap mock. Content swaps are visible as state transitions. The queue-and-acknowledge pattern handles the "editor not mounted yet" case naturally.

### ADR-REV-004: Revision ID as staleness token, replacing isSwappingContent guard

- **Context:** v1 used an `isSwappingContent` boolean flag, set before and cleared after content swap, to prevent `onUpdate` from triggering a save during the swap.
- **Decision:** The editor's `onUpdate` always includes the current revision ID (from a ref). The store's save entry point checks this ID against `loadedRevisionId`. A mismatch means the save is stale and is discarded.
- **Consequences:** No flag to set/clear. No timing sensitivity (flag set before swap, cleared after — what if an exception prevents clearing?). The ID check is stateless and deterministic.

### ADR-REV-005: Single artifact per conversation

- **Context:** Schema supports multiple artifacts. Full multi-artifact UI multiplies complexity.
- **Decision:** UI and store assume one artifact per conversation. `loadForConversation` queries with `LIMIT 1`. Schema remains multi-artifact-ready.
- **Consequences:** `ArtifactTabs` deferred. `conversations.active_artifact_id` is always the single artifact's ID.

### ADR-REV-006: useLayoutEffect for content swap (v3 fix)

- **Context:** v2 processed `contentSwapRequest` inline during render. This violates React's purity rule for render functions. In Strict Mode, render runs twice, causing double `setContent` and double `acknowledgeSwap`.
- **Decision:** Move content swap processing to `useLayoutEffect`. Runs after DOM commit, before paint (no flicker). Strict Mode safe — cleanup runs first on re-invocation.
- **Consequences:** Swap is slightly deferred vs inline (after DOM commit vs during render), but still synchronous before paint. `useLayoutEffect` deps must include `swapRequest` and `editor`. The swap is idempotent (double-run is harmless).

### ADR-REV-007: Dedicated useLayoutEffect for revisionIdRef sync (v3 fix)

- **Context:** v2's `_createDraftThenPersist` updates `loadedRevisionId` in the store without setting `contentSwapRequest` (because the editor already has the correct content). The editor's `revisionIdRef` was never updated, causing all subsequent saves to be discarded as stale.
- **Decision:** A second `useLayoutEffect` watches `loadedRevisionId`. When it changes and no `contentSwapRequest` is pending (meaning the content didn't change, only the revision ID did), it syncs `revisionIdRef`.
- **Consequences:** `revisionIdRef` is updated in exactly two code paths: the swap effect and the sync effect. The `!swapRequest` guard prevents double-update when both fire in the same cycle.

### ADR-REV-008: Flush re-reads from editor, not from captured ref (v3 fix)

- **Context:** v2's `flushPendingSave` used `pendingSaveRef.current` — content captured at the last `onUpdate`. If the user types and immediately sends within the same event loop tick, `onUpdate` may not have fired yet, making the captured content stale.
- **Decision:** `flushPendingSave` calls `editor.storage.markdown.getMarkdown()` directly, guaranteeing the latest content regardless of `onUpdate` timing.
- **Consequences:** Requires holding an `editorRef` in the component. The ref is set in `onCreate` and on each render (since `useEditor` may return a new instance). The store does NOT hold this ref — only the component uses it.

---

## 22. Changelog from v2

| # | Issue | Fix | Sections affected |
|---|-------|-----|-------------------|
| 1 | Content swap processed inline during render — violates React purity, breaks in Strict Mode | Moved to `useLayoutEffect` | §3 (principle 4), §8.2, §10.1, ADR-REV-006 |
| 2 | `revisionIdRef` not updated after `_createDraftThenPersist` — subsequent saves silently discarded | Added dedicated `useLayoutEffect` watching `loadedRevisionId` | §3 (principle 6), §8.3, §10.1, §16 EC-3, ADR-REV-007 |
| 3 | `flushPendingSave` used stale captured content from `pendingSaveRef` | Flush re-reads fresh content from `editor.storage.markdown.getMarkdown()` | §10.1, §10.2, ADR-REV-008 |
| 4 | No concurrency guard on save chain — two saves could create duplicate drafts | Added `isSaving` check at save entry point | §6.2, §6.3, §16 EC-10, EC-11 |
| 5 | `flushPendingSave` was sync (fire-and-forget) — seal could run before save completed | Flush now returns `Promise<void>`; send handler awaits it | §7.1, §10.1, §10.2 |
| 6 | "Unsaved" indicator used ref in JSX (never triggers re-render) | Removed unreliable indicator; documented how to add a correct one | §10.3 |
