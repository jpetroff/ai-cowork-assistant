## 1. Thread `artifactId` through the metadata pipeline

- [x] 1.1 In `src/lib/types.ts`, add `artifactId?: string` to `RevisionMessageMetadata` (optional for backward compat with stored messages)
- [x] 1.2 In `src/lib/db/repositories/messages.ts`, add `artifactId: string` to `createSystemRevisionMessage` data param and include it in the persisted `metadata` JSON
- [x] 1.3 In `src/stores/messageStore.ts`, add `artifactId: string` as a required parameter to `addSystemRevisionMessage` (interface + implementation); include it when constructing the in-memory `RevisionMessageMetadata` object

## 2. Update artifactStore call sites

- [x] 2.1 Update `save()` call to `addSystemRevisionMessage` (first-draft anchor) to pass `artifact.id`
- [x] 2.2 Update `_sealDraftInPlace()` call to `addSystemRevisionMessage` to pass `artifact.id`
- [x] 2.3 Update `_createSealedRevision()` call to `addSystemRevisionMessage` to pass `artifact.id`
- [x] 2.4 Update `applyAiRevision()` call to `addSystemRevisionMessage` to pass `artifact.id`

## 3. Refactor ArtifactRevisionCard

- [x] 3.1 Replace the `artifactTitle` store selector (`s.artifact?.title`) with a single `getArtifactRevisionMeta` selector: `useArtifactStore(s => s.getArtifactRevisionMeta(meta.artifactId ?? '', { revisionId: meta.revisionId }))`
- [x] 3.2 Return `null` from the component when `getArtifactRevisionMeta` returns `null`
- [x] 3.3 Derive `artifactTitle` and `isLoaded` from the resolved meta object instead of separate store selectors

## 4. Update tests

- [x] 4.1 Update `messageStore.test.ts`: add `artifactId` arg to all `addSystemRevisionMessage` calls; assert `artifactId` is present in the stored metadata
- [x] 4.2 Update `artifactStore.test.ts`: update `mockAddSystemRevisionMessage` call signature expectation to include `artifactId`
- [x] 4.3 Update `src/lib/db/__tests__/repositories/messages.test.ts`: add `artifactId` to `createSystemRevisionMessage` test payloads and assert it appears in the persisted metadata
