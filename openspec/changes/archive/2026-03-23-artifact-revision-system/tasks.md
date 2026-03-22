## 1. Database Migration (db.rs)

- [x] 1.1 Remove `content`, `version`, `last_author`, `message_id` columns from `artifacts` table definition; add `current_revision_id TEXT` (no FK)
- [x] 1.2 Add `active_artifact_id TEXT` column to `conversations` table (no FK)
- [x] 1.3 Add `CREATE TABLE IF NOT EXISTS artifact_revisions` with all columns: `id`, `artifact_id` (FK → artifacts ON DELETE CASCADE), `message_id` (FK → messages ON DELETE SET NULL), `author` (CHECK IN 'user','ai'), `content`, `created_at`, `updated_at`
- [x] 1.4 Add index `idx_rev_artifact` on `(artifact_id, created_at DESC)`
- [x] 1.5 Add partial index `idx_rev_message` on `(message_id) WHERE message_id IS NOT NULL`
- [x] 1.6 Drop old `idx_art_conv` index on `(conversation_id, version)` and replace with `idx_art_conv` on `(conversation_id)`

## 2. TypeScript Types (types.ts)

- [x] 2.1 Remove `content`, `version`, `last_author`, `message_id` from `Artifact` interface; add `current_revision_id: string | null`
- [x] 2.2 Add `ArtifactRevision` interface: `id`, `artifact_id`, `message_id: string | null`, `author: 'user' | 'ai'`, `content`, `created_at`, `updated_at`
- [x] 2.3 Add `'artifact_revisions'` to `TableName` union type
- [x] 2.4 Add `active_artifact_id: string | null` to `Conversation` interface

## 3. Repository: documents.ts (replaces artifacts.ts)

- [x] 3.1 Create `src/lib/db/repositories/documents.ts` with `createArtifact({ conversation_id, title? })` — inserts metadata row only, no content
- [x] 3.2 Add `getArtifact(id)` → returns `Artifact | null`
- [x] 3.3 Add `listArtifacts(conversationId)` → ordered by `created_at ASC`
- [x] 3.4 Add `listArtifactsByProject(projectId, limit?)` → JOIN through conversations, ordered by `updated_at DESC`
- [x] 3.5 Add `updateArtifact(id, data: Partial<Pick<Artifact, 'title' | 'file_path' | 'file_hash' | 'current_revision_id'>>)`
- [x] 3.6 Add `deleteArtifact(id)`
- [x] 3.7 Delete `src/lib/db/repositories/artifacts.ts`

## 4. Repository: revisions.ts (new)

- [x] 4.1 Create `src/lib/db/repositories/revisions.ts` with `createRevision({ artifact_id, author, content?, message_id? })` — inserts revision row AND updates `artifacts.current_revision_id` to new id
- [x] 4.2 Add `getRevision(id)` → returns `ArtifactRevision | null`
- [x] 4.3 Add `getHeadRevision(artifactId)` → joins `artifacts.current_revision_id` to return HEAD, or null
- [x] 4.4 Add `listRevisions(artifactId)` → ordered by `created_at DESC`
- [x] 4.5 Add `updateRevisionContent(id, content)` — updates `content` and `updated_at` on a single revision row
- [x] 4.6 Add `sealRevision(id, messageId)` — sets `message_id` on the revision row

## 5. Repository Index & Conversation Store

- [x] 5.1 Update `src/lib/db/repositories/index.ts` — replace `artifacts` export with `documents` and `revisions` exports
- [x] 5.2 Update `src/stores/conversationStore.ts` `create()` action — call `createArtifact` (documents repo) then `createRevision` (revisions repo) for the initial empty artifact; set `conversations.active_artifact_id` to the new artifact id
- [x] 5.3 Add `setActiveArtifact(conversationId, artifactId)` action to `conversationStore` that persists `active_artifact_id` to SQLite

## 6. Wiring & Cleanup

- [x] 6.1 Update any remaining imports of `createArtifact` / `updateArtifact` / `listArtifacts` from old `artifacts` repo to the new `documents` / `revisions` modules
- [x] 6.2 Update `src/lib/db/index.ts` re-exports if applicable
- [x] 6.3 Verify `bunx tsc --noEmit` passes with no type errors
