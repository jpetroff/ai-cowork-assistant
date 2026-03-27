## Why

Components throughout the app need to look up artifact and revision metadata (title, author, timestamps, etc.) given either an artifact ID or revision ID, but currently there's no shared utility for this — each component would have to re-implement store subscriptions or manual list traversal. Adding a single accessor in `artifactStore` removes duplication and provides a consistent interface.

## What Changes

- Add `getArtifactRevisionMeta(artifactId, options?)` function to `artifactStore` that:
  - Accepts an artifact ID and returns metadata for the artifact and its latest (head) revision
  - Accepts an optional `revisionId` to return metadata for a specific revision instead
  - Accepts an optional `includeContent` flag (default: `false`) to control whether revision `content` is included in the return value
- The function is exported as a plain (non-reactive) accessor for use in non-React code, and also exposed via a selector on the store for reactive use in components

## Capabilities

### New Capabilities
- `artifact-revision-meta-accessor`: A lookup utility function in `artifactStore` that retrieves artifact + revision metadata by artifact ID (optionally scoped to a specific revision), with an option to include or exclude revision content.

### Modified Capabilities

## Impact

- `src/stores/artifactStore.ts` — new function added
- Any component that currently drills into the store or passes raw revision data down as props can migrate to this accessor
