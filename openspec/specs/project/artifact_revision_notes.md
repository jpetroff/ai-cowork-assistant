# Artifact Revision System — Contextual Constraints for AI Proposals

> **Include this section in any prompt that proposes or designs a feature touching the editor, chat send flow, artifact state, or revision history.**

---

## Architecture: What exists and why it is the way it is

This app uses an **artifact revision system** (spec v3). One artifact per conversation. Content lives in `artifact_revisions`, not in `artifacts`. `artifacts` is metadata only.

**Data model invariants — violating these is a bug:**

- `HEAD = artifact.currentRevisionId`. Only HEAD's `content` and `updatedAt` may mutate in place.
- Non-HEAD revisions are **immutable** after creation.
- `messageId === null` means **draft** (unsent, editable). `messageId !== null` means **sealed** (linked to a message, immutable).
- In-place editing is only allowed when `HEAD.author === 'user' AND HEAD.messageId === null`.
- `canEditInPlace(head)` is the canonical gate — never re-implement this inline.

**Store state rules — do not add or reintroduce these:**

- No `isDirty` flag in the store. The editor's pending debounce timer IS the dirty state.
- No `isSwappingContent` guard. Staleness is handled by `revisionId` mismatch in the save chain.
- No `editorInstance` in the store. The store never calls editor methods directly.
- No flush callback registered in the store state. The `_flushRef` coordination pattern is used instead.

---

## The save chain (chain of responsibility, no branching ladders)

`save({ revisionId, content })` is called by the editor after debounce fires. It routes to exactly one of:

1. **Stale check** → `loadedRevisionId !== revisionId` → discard, return.
2. **Concurrency guard** → `isSaving === true` → discard, return.
3. **HEAD, editable draft** → `_persistToHead` (update in place, no new revision)
4. **HEAD, not editable** → `_createDraftThenPersist` (new user draft, no content swap needed)
5. **Non-HEAD revision** → `_createDraftFromOldRevision` (new user draft from old content)

Critical: steps 4 and 5 update `loadedRevisionId` in the store **without setting `contentSwapRequest`** because the editor already has the correct content. The editor component must observe `loadedRevisionId` changes via a second `useLayoutEffect` and sync `revisionIdRef` — otherwise the next `onUpdate` carries a stale revision ID and is silently discarded.

---

## The `revisionIdRef` — only two update points (invariant)

`revisionIdRef.current` in `EditorPanel` is the single source of truth for which revision the editor is editing. It is updated in **exactly two places**:

1. `useLayoutEffect` processing a `contentSwapRequest` (step 4 in swap protocol)
2. `useLayoutEffect` observing `loadedRevisionId` changed **without** a `contentSwapRequest` (the draft-creation case)

No other code path may update this ref. This was the v2 bug: draft creation updated `loadedRevisionId` but `revisionIdRef` stayed stale, causing the next save to be discarded.

---

## Content swap protocol (store → editor, never direct)

When the store needs to change editor content (load, AI revision, revert), it sets `contentSwapRequest: { revisionId, content }`. The component processes this in `useLayoutEffect` (not inline render — inline render violates React's purity rule and double-fires in Strict Mode):

```text
1. Flush pending save for previous document (stale check will discard it)
2. editor.commands.setContent(content, false)  ← emitUpdate: false
3. editor.commands.clearHistory()              ← prevent cross-document undo
4. revisionIdRef.current = swapRequest.revisionId
5. acknowledgeSwap()
```

`contentSwapRequest` is only set when the **store** decides the content must change. When the **editor** originates the change (user typing), no swap is set.

---

## Flush-before-seal protocol (send flow)

Before calling `sealForSend`, the send handler **must** flush the editor:

```typescript
await useArtifactStore.getState()._flushRef.current?.();  // flush + await save
const sealResult = await useArtifactStore.getState().sealForSend(msgId);
```

`flushPendingSave` reads content from `editor.storage.markdown.getMarkdown()` directly — not from a stale ref. This handles the case where the user types and sends within the same event loop tick before `onUpdate` fires.

---

## Seal chain — four paths (before sending a message)

`sealForSend(messageId)` routes to exactly one of:
- Draft HEAD + content changed → `_sealDraftInPlace` (sets messageId in place)
- Draft HEAD + unchanged → `_reuseLastSealed` (no write)
- Sealed HEAD + content changed → `_createSealedRevision` (new sealed revision)
- Sealed HEAD + unchanged → `_reuseCurrentHead` (no write)

Returns `SealResult | null`. A `null` result means no artifact context is sent with the message.

---

## Debounce ownership

The debounce timer lives **in the editor component**, not the store. The store has zero timers. `DEBOUNCE_MS = 1000`. When `save()` is called by the store from the flush, it executes immediately.

---

## Thread display

The chat thread merges two item types by `createdAt`:

- Messages (existing)
- Revision cards — **only revisions where `messageId IS NOT NULL`** (drafts are not shown)

---

## Key files (as of spec v3)

| Purpose | File |
|---|---|
| Types | `src/lib/db/types.ts` |
| Pure functions | `src/lib/revision-utils.ts` |
| DB helpers | `src/lib/db/repositories/revisions.ts` |
| Store | `src/stores/artifactStore.ts` |
| Editor component | `src/components/editor/EditorPanel.tsx` |
| Revision picker | `src/components/editor/RevisionPicker.tsx` |
| Chat thread cards | `src/components/chat/RevisionCard.tsx` |
| Sidecar integration | `src/stores/conversationStore.ts` (`_dispatch` case, `sendChatRequest`) |

---

## Known edge cases to respect in new designs

- **EC-7**: `setContent(content, false)` may still fire `onUpdate` in TipTap (known bug #1715). If content is empty after swap, add a guard in `onUpdate`.
- **EC-9**: React Strict Mode double-runs `useLayoutEffect`. All swap operations must be idempotent (`setContent` same content twice = harmless; `acknowledgeSwap` sets null twice = harmless).
- **EC-10**: Two concurrent saves could both enter `_createDraftThenPersist`. The `isSaving` guard at the save entry point prevents this.
- **EC-11**: If `isSaving` is true when flush is called (in-flight debounce save), the flush save is discarded — the in-flight save already has recent content.
