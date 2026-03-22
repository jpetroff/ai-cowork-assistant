## Why

Artifacts currently store content directly in the `artifacts` table with a monotonic `version` counter, giving no way to recover a previous state after AI or user edits. The product requires a canvas-style model (like OpenAI Canvas) where every meaningful content change is preserved as an immutable revision, users can navigate full history from the chat thread, and AI can never silently overwrite user work.

## What Changes

- **BREAKING** — `artifacts` table loses `content`, `version`, `last_author`, `message_id` columns; gains `current_revision_id` soft-ref pointer
- **BREAKING** — `conversations` table gains `active_artifact_id` soft-ref pointer (which document is open in the editor)
- New `artifact_revisions` table holds all content with `author`, `message_id`, and timestamps
- Revision creation is governed by explicit author-switch and send-time rules (see design)
- `artifacts` repository is replaced by split `artifacts` (metadata) + `revisions` (content) repositories
- `artifactStore` is replaced by a revision-aware `documentStore` that enforces the copy-on-write editing gate
- Chat thread merges messages and linked revisions into a single chronological timeline

## Capabilities

### New Capabilities

- `artifact-revisions`: Revision lifecycle — creation rules, in-place editing gate, send-time sealing, AI write behaviour, history navigation, and copy-on-write when loading a non-HEAD revision

### Modified Capabilities

- `database-schema`: Add `artifact_revisions` table; modify `artifacts` (remove content/version, add `current_revision_id`); add `active_artifact_id` to `conversations`; update TypeScript types and repositories to match

## Impact

- `src-tauri/src/db.rs` — migration v1 rewritten (clean-slate dev assumption)
- `src/lib/db/types.ts` — `Artifact` type updated; new `ArtifactRevision` type added; `TableName` union updated
- `src/lib/db/repositories/artifacts.ts` — replaced by `documents.ts` (artifact metadata CRUD) and `revisions.ts` (revision CRUD)
- `src/lib/db/repositories/index.ts` — updated exports
- `src/stores/conversationStore.ts` — updated to persist `active_artifact_id`

Frontend editor and store changes are out of scope for this change and will be addressed in a follow-up.
