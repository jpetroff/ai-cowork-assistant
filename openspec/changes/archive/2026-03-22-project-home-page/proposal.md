## Why

The project home page (`/projects/:projectId`) is a skeleton placeholder — users who click a project see only loading skeletons with no content. This change builds the full project hub: the central screen where users start tasks, review past chats, and configure project resources and AI settings.

## What Changes

- Replace the skeleton `ProjectPage` with a fully functional two-column layout
- Implement inline project rename directly in the page header
- Add `conversationStore` for loading, creating, renaming, and deleting conversations per project
- Extend artifact repository with flexible project-scoped queries (`listArtifactsByProject`)
- Add project-scoped AI configuration (LLM provider, model, embedding model) stored as `app_settings` JSON entries
- Add `llmProviderStore` to load providers and their available models, used by the AI config card
- Wire the route loader (`projects/:projectId`) to load conversations and set active project
- Add a stub `FilesCard` (UI only, no backend logic) to reserve the upload-files surface

## Capabilities

### New Capabilities

- `project-home`: The project home screen — two-column layout with new-task input, conversation list (with rename/delete), and a right sidebar of cards (artifacts, folder, files stub, AI config)
- `conversation-management`: CRUD operations for conversations within a project — create, list, rename, delete, with per-id operation state tracking
- `project-ai-config`: Per-project AI configuration stored as JSON in `app_settings` — LLM provider, model, and embedding model overrides

### Modified Capabilities

- `project-management`: Inline rename is added directly on the project home header (in addition to the existing rename on the project list card); no requirement-level behavior change otherwise
- `database-schema`: Artifact queries gain a project-scoped variant (`listArtifactsByProject` via JOIN); this is additive and does not change existing query behavior

## Impact

- **New files**: `conversationStore.ts`, `llmProviderStore.ts`, multiple components under `src/components/projects/` and a new `src/components/conversations/` directory
- **Modified files**: `src/pages/ProjectPage.tsx`, `src/router.tsx`, `src/lib/db/repositories/artifacts.ts`
- **No DB migrations required** — project AI config uses existing `app_settings` key-value table; clean state assumed
- **No new dependencies** — uses existing shadcn/ui components, Tailwind, Zustand, React Router patterns already established in the codebase
