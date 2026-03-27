## Context

The revision card (`ArtifactRevisionCard`) currently derives its display data by directly reading `s.artifact?.title` from the store. This silently assumes the currently loaded artifact is the one the card refers to—there is no cross-check. The `RevisionMessageMetadata` type doesn't include `artifactId`, so the card has no way to perform that check even if it wanted to.

`getArtifactRevisionMeta(artifactId, { revisionId })` was just introduced precisely to perform this validated lookup. The fix threads `artifactId` through the entire metadata pipeline so the card can use it.

The call chain that must change:
```
RevisionMessageMetadata.artifactId  (types.ts)
  → createSystemRevisionMessage data param  (repositories/messages.ts)
  → addSystemRevisionMessage signature  (messageStore.ts)
  → all call sites in artifactStore.ts  (4 sites)
  → ArtifactRevisionCard reads meta.artifactId  (ArtifactRevisionCard.tsx)
```

## Goals / Non-Goals

**Goals:**
- `RevisionMessageMetadata` carries `artifactId` so the card knows which artifact a revision belongs to
- `ArtifactRevisionCard` uses `getArtifactRevisionMeta(meta.artifactId, { revisionId: meta.revisionId })` as its data source
- Card renders a neutral fallback when `getArtifactRevisionMeta` returns `null` (artifact not loaded / cross-conversation card)
- Existing messages lacking `artifactId` in their stored JSON are handled gracefully (field is optional on read)

**Non-Goals:**
- No database migration — `artifactId` is stored in the `metadata` JSON column which is schema-free; old rows simply won't have the field
- No backfill of historical messages
- No change to card visual design beyond the data source

## Decisions

### `artifactId` is optional in `RevisionMessageMetadata` for backward compatibility
Old messages in the DB won't have `artifactId`. Making it optional (`artifactId?: string`) means parsing never fails. When the field is absent, `getArtifactRevisionMeta` cannot be called with a valid ID and the card falls back to a "revision unavailable" state (or hides itself).

**Alternative:** make it required and accept that old cards break. Rejected — degraded display is better than broken UI for historical data.

### Card falls back to `null` render when `getArtifactRevisionMeta` returns null
If `meta.artifactId` is missing or doesn't match the loaded artifact, the card returns `null` (renders nothing). This is consistent with the existing guard `if (!meta) return null`.

**Alternative:** show a static "revision from another session" placeholder. Deferred — out of scope; the primary goal is correctness for the current session.

### `addSystemRevisionMessage` gains an `artifactId` parameter
All four call sites in `artifactStore` have `artifact` in scope. Passing `artifact.id` is trivial and makes the fix complete.

## Risks / Trade-offs

- **Historical cards will disappear** after this change: cards created before the fix lack `artifactId` in metadata, so `getArtifactRevisionMeta` returns null and the card renders nothing.
  → Accepted trade-off. Showing a card with a potentially wrong title is worse than not showing it.

- **Four call sites in artifactStore.ts must all be updated**: missing one leaves a call site producing metadata without `artifactId`.
  → Mitigation: TypeScript will error on the updated `addSystemRevisionMessage` signature if any call site is missed (parameter is required).
