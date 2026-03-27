## Context

`artifactStore` (Zustand) holds `artifact`, `headRevision`, and `revisions[]` in its state. Components that need to display artifact/revision metadata (e.g. revision cards in chat, editor header) currently access these fields directly via `useArtifactStore` selectors or receive them as props. There is no shared utility for "give me the metadata for artifact X / revision Y", which leads to duplicated traversal logic as more components need this data.

The store already exports `getArtifactStore()` for non-reactive access. The new accessor follows the same pattern.

## Goals / Non-Goals

**Goals:**
- Single function `getArtifactRevisionMeta(artifactId, options?)` that returns `{ artifact, revision }` metadata
- Works with artifact ID alone (returns head revision) or artifact ID + revision ID (returns specific revision)
- `includeContent` option (default `false`) strips `content` from the revision to avoid passing large strings to display-only components
- Exported as a plain accessor for non-React code and usable as a Zustand selector in components

**Non-Goals:**
- Not a reactive hook — consumers who need reactivity use `useArtifactStore` with this function as a selector
- Does not fetch from the database — reads only from in-memory store state
- Does not support cross-conversation lookups (operates only on the currently loaded artifact/revisions)

## Decisions

### Return shape: `{ artifact, revision } | null`
Returns `null` when the artifact ID doesn't match the loaded artifact, rather than throwing. Display components should handle `null` gracefully (e.g., skip rendering). This avoids crashing on stale IDs from message metadata.

**Alternative considered:** Return `undefined` — `null` is more explicit and conventional for "no result" in this codebase.

### `includeContent` defaults to `false`
Revision content can be large. Components showing metadata (author, timestamp, revision number) don't need it. Opt-in keeps the common case efficient.

**Alternative considered:** Always include content, let caller ignore it — wastes memory/referential equality checks in Zustand selectors.

### Placed in `artifactStore` (not a separate utility file)
The data lives in the store; the accessor belongs beside it. Avoids an extra import path and keeps the lookup co-located with the state it reads.

### No `revisionId`-only overload
Requiring `artifactId` makes the lookup deterministic and avoids a full scan of revisions across potential future multi-artifact state. If only a `revisionId` is known, the caller must also supply the `artifactId`.

## Risks / Trade-offs

- **Stale data on conversation switch**: The function reads from in-memory state. If called after `reset()` but before the next `loadForConversation` completes, it returns `null` — expected behavior, but callers must handle it.
  → Mitigation: `null` return is explicit; components should show a loading/empty state.

- **No cross-conversation lookup**: Messages may reference revisions from a previous conversation's artifact. This accessor won't resolve those.
  → Mitigation: Out of scope per Non-Goals; chat revision cards should only render lookup results when the IDs match the loaded conversation.
