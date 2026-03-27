## Why

`ArtifactRevisionCard` displays the title of whichever artifact is currently loaded in `artifactStore`, without verifying that the revision referenced by the card actually belongs to that artifact. Additionally, `RevisionMessageMetadata` (the parsed payload on system messages) does not carry `artifactId`, so there is no way to perform that validation at the card level. This means cards in the chat thread can silently show the wrong title—or behave incorrectly—when the loaded artifact differs from the one the message was anchored to. The recently added `getArtifactRevisionMeta` accessor exists exactly to solve this lookup correctly, but the card does not use it.

## What Changes

- Add `artifactId` to `RevisionMessageMetadata` so every revision system message carries the full identity of its artifact
- Update all call sites that create revision system messages (`addSystemRevisionMessage`) to pass `artifactId`
- Refactor `ArtifactRevisionCard` to resolve its display data via `getArtifactRevisionMeta(meta.artifactId, { revisionId: meta.revisionId })` instead of reading `s.artifact?.title` directly
- When `getArtifactRevisionMeta` returns `null` (artifact/revision not loaded), the card renders a graceful fallback rather than stale/incorrect data

## Capabilities

### New Capabilities

### Modified Capabilities
- `revision-chat-cards`: Card now validates artifact ownership before displaying metadata; graceful null-state when artifact is not loaded

## Impact

- `src/lib/types.ts` — `RevisionMessageMetadata` gains `artifactId` field
- `src/stores/messageStore.ts` — `addSystemRevisionMessage` signature updated to accept and persist `artifactId`
- `src/stores/artifactStore.ts` — all `addSystemRevisionMessage` call sites updated to pass `artifact.id`
- `src/components/chat/ArtifactRevisionCard.tsx` — refactored to use `getArtifactRevisionMeta` selector
