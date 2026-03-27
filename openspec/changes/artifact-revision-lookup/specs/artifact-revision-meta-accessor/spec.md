## ADDED Requirements

### Requirement: Lookup artifact and revision metadata by artifact ID
The store SHALL expose a `getArtifactRevisionMeta(artifactId, options?)` function that accepts an artifact ID and optional options, and returns the matching artifact and revision metadata from the currently loaded store state. If the provided `artifactId` does not match the currently loaded artifact, the function SHALL return `null`.

#### Scenario: Artifact ID matches loaded artifact, no revision ID provided
- **WHEN** `getArtifactRevisionMeta` is called with the ID of the currently loaded artifact and no `revisionId` option
- **THEN** the function returns `{ artifact, revision }` where `revision` is the current `headRevision`

#### Scenario: Artifact ID does not match loaded artifact
- **WHEN** `getArtifactRevisionMeta` is called with an artifact ID that differs from the currently loaded artifact's ID
- **THEN** the function returns `null`

#### Scenario: No artifact is loaded in the store
- **WHEN** `getArtifactRevisionMeta` is called and `artifact` in the store is `null`
- **THEN** the function returns `null`

### Requirement: Lookup a specific revision by revision ID
When a `revisionId` is supplied in options, the function SHALL return that specific revision from the loaded `revisions` array instead of the head revision.

#### Scenario: Specified revision ID exists in the loaded revisions list
- **WHEN** `getArtifactRevisionMeta` is called with a valid `artifactId` and a `revisionId` that exists in the store's `revisions` array
- **THEN** the function returns `{ artifact, revision }` where `revision` matches the specified `revisionId`

#### Scenario: Specified revision ID does not exist in the loaded revisions list
- **WHEN** `getArtifactRevisionMeta` is called with a valid `artifactId` and a `revisionId` that is NOT in the store's `revisions` array
- **THEN** the function returns `null`

### Requirement: Exclude revision content by default
By default, the returned revision object SHALL have its `content` field omitted, to avoid passing large strings to display-only components.

#### Scenario: `includeContent` not specified
- **WHEN** `getArtifactRevisionMeta` is called without the `includeContent` option (or with `includeContent: false`)
- **THEN** the returned `revision` object does not include a `content` property

#### Scenario: `includeContent: true` is specified
- **WHEN** `getArtifactRevisionMeta` is called with `{ includeContent: true }`
- **THEN** the returned `revision` object includes the full `content` string

### Requirement: Accessible as both a plain accessor and a Zustand selector
The function SHALL be usable both as a standalone (non-reactive) call via `getArtifactStore()` and as an inline selector in `useArtifactStore(...)` for reactive component subscriptions.

#### Scenario: Non-reactive usage in non-React code
- **WHEN** `getArtifactStore().getArtifactRevisionMeta(id)` is called outside a React component
- **THEN** it returns the current metadata from the store state at call time

#### Scenario: Reactive usage as a selector in a React component
- **WHEN** `useArtifactStore(s => s.getArtifactRevisionMeta(id))` is called inside a React component
- **THEN** the component re-renders whenever the relevant artifact or revision data changes
