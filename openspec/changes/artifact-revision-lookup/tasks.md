## 1. Type Definitions

- [ ] 1.1 Define `ArtifactRevisionMetaOptions` interface (`revisionId?: string`, `includeContent?: boolean`)
- [ ] 1.2 Define `ArtifactRevisionMeta` return type with `artifact: Artifact` and `revision: Omit<ArtifactRevision, 'content'> | ArtifactRevision`

## 2. Core Implementation

- [ ] 2.1 Add `getArtifactRevisionMeta` to `ArtifactActions` interface in `artifactStore.ts`
- [ ] 2.2 Implement the function in the store: match `artifactId` against loaded artifact, return `null` on mismatch or missing artifact
- [ ] 2.3 When no `revisionId` option is given, use `headRevision` as the target revision; return `null` if `headRevision` is `null`
- [ ] 2.4 When `revisionId` is given, look up the revision in `revisions[]`; return `null` if not found
- [ ] 2.5 Strip `content` from the returned revision when `includeContent` is falsy (default)
- [ ] 2.6 Include `content` in the returned revision when `includeContent: true`

## 3. Tests

- [ ] 3.1 Update `artifactStore.test.ts`: add test — artifact ID matches, no revisionId → returns head revision without content
- [ ] 3.2 Add test — artifact ID matches, revisionId given → returns specific revision without content
- [ ] 3.3 Add test — artifact ID does not match → returns null
- [ ] 3.4 Add test — no artifact loaded → returns null
- [ ] 3.5 Add test — revisionId not found in revisions → returns null
- [ ] 3.6 Add test — `includeContent: true` → returned revision includes content field
