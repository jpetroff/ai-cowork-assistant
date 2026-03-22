## 1. Data Layer — Repositories

- [x] 1.1 Add `listArtifactsByProject(projectId: string, limit?: number)` to `src/lib/db/repositories/artifacts.ts` using a JOIN through `conversations` on `project_id`, ordered by `artifacts.updated_at DESC`
- [x] 1.2 Add `updateProject(id, data)` to `src/lib/db/repositories/projects.ts` that persists partial field updates (supports `{ folder_path }` and other partial fields) using a dynamic SET clause

## 2. Stores — New and Extended

- [x] 2.1 Create `src/stores/conversationStore.ts` with: `conversations`, `activeConversationId`, `status`, `operationStates`; actions: `loadForProject(projectId)`, `create(projectId)`, `rename(id, title)`, `delete(id)`, `setActive(id)` — mirror `projectStore` patterns including per-id operation guards and `notificationStore` error pushes
- [x] 2.2 Create `src/stores/llmProviderStore.ts` with: `providers`, `modelsByProvider`, `status`; actions: `loadAll()` (reads from `llm_providers` table), `fetchModels(providerId)` (calls provider `/models` endpoint, caches in `modelsByProvider`)
- [x] 2.3 Create `src/stores/projectSettingsStore.ts` with: `aiConfigs: Record<string, ProjectAiConfig>`; actions: `loadAiConfig(projectId)` (reads `app_settings` key `project:{id}:ai_config`, defaults to null fields on missing/corrupt JSON), `saveAiConfig(projectId, config)` (upserts to `app_settings`)
- [x] 2.4 Add `update(id, data: Partial<Pick<Project, 'folder_path'>>)` action to `src/stores/projectStore.ts` that calls the new `updateProject` repository function and updates the store entry in place

## 3. Router

- [x] 3.1 Update the `projects/:projectId` route loader in `src/router.tsx` to call `projectStore.getState().setActive(projectId)`, `conversationStore.getState().loadForProject(projectId)`, `projectSettingsStore.getState().loadAiConfig(projectId)`, and `llmProviderStore.getState().loadAll()`
- [x] 3.2 Update the `projects/:projectId/chats/:chatId` route loader to call `conversationStore.getState().setActive(chatId)`

## 4. Project Home Page — Layout and Header

- [x] 4.1 Create `src/components/projects/ProjectHeader.tsx`: displays project name as a clickable `<h1>`; on click switches to an inline `<input>` pre-filled with the name plus ✓ (`CheckIcon`) and × (`XIcon`) buttons; Enter applies, Escape discards; calls `projectStore.rename(id, newName)` on apply; includes a "← Projects" back link that navigates to `/`
- [x] 4.2 Rewrite `src/pages/ProjectPage.tsx` as a full page: renders `ProjectHeader`, then a `max-w-5xl mx-auto` content area with a `flex gap-6` row — left column (`flex-1`) and right column (`w-80 shrink-0`)

## 5. Left Column — New Task Input

- [x] 5.1 Create `src/components/conversations/NewTaskInput.tsx`: auto-growing `<textarea>` (use `field-sizing: content` via Tailwind or a resize observer); placeholder "What would you like to work on?"; Send button positioned bottom-right inside the input frame; Enter inserts newline; Cmd+Enter / Ctrl+Enter submits; button disabled when input is empty or whitespace-only; on submit calls `conversationStore.create(projectId)` and navigates to `/projects/:projectId/chats/:id`

## 6. Left Column — Conversation List

- [x] 6.1 Create `src/components/conversations/ConversationListEmpty.tsx`: empty state component with icon and message "Start a task above to create your first chat"
- [x] 6.2 Create `src/components/conversations/ConversationRow.tsx`: renders title (or "Untitled" if null) + relative timestamp; wraps with a `group` class for hover detection; shows `...` DropdownMenu trigger on `group-hover:opacity-100`; dropdown contains Rename (triggers inline title input on the row) and Delete (opens AlertDialog confirmation); clicking the row body navigates to `/projects/:projectId/chats/:id`; uses `conversationStore.rename` and `conversationStore.delete`; shows `Spinner` during in-flight operation
- [x] 6.3 Create `src/components/conversations/ConversationList.tsx`: reads `conversationStore.conversations`; renders `ConversationListEmpty` when empty, otherwise maps over conversations and renders `ConversationRow` items

## 7. Right Column — Cards

- [x] 7.1 Create `src/components/projects/ArtifactsModal.tsx`: a `Sheet` (slide-over) that accepts `projectId`, calls `listArtifactsByProject(projectId)` on open (or reads from store), and lists all artifacts with title and updated-at timestamp in reverse chronological order
- [x] 7.2 Create `src/components/projects/ArtifactsCard.tsx`: reads `projectId`; on mount fetches `listArtifactsByProject(projectId, 3)` for preview and total count (`listArtifactsByProject(projectId)` length or a count query); renders count in card title, lists 3 artifact titles, renders "Show all →" button that opens `ArtifactsModal`; shows empty state message when count is 0
- [x] 7.3 Create `src/components/projects/FolderCard.tsx`: reads `projectStore.projects` to find the active project's `folder_path`; if set, shows the path and a "Change folder" button; if null, shows "Attach folder" CTA button; both buttons call the Tauri `@tauri-apps/plugin-dialog` folder picker and on selection call `projectStore.update(id, { folder_path })`
- [x] 7.4 Create `src/components/projects/FilesCard.tsx`: renders a card with an "Upload file" button (non-functional, no onClick handler or with a TODO comment) and empty state text "No files uploaded yet — coming soon"; add a visual "stub" badge or muted label to signal this is not yet active
- [x] 7.5 Create `src/components/projects/AiConfigCard.tsx`: reads `llmProviderStore.providers`, `llmProviderStore.modelsByProvider`, and `projectSettingsStore.aiConfigs[projectId]`; renders three Select components (LLM Provider, LLM Model, Embedding Model); when `providers` is empty — all selects disabled + "Configure in Settings →" button (navigates to `/settings`, route not yet implemented); on provider select change calls `llmProviderStore.fetchModels(providerId)` and saves config; on model or embedding change saves config via `projectSettingsStore.saveAiConfig`

## 8. Compose Right Sidebar

- [x] 8.1 Compose the right column in `ProjectPage.tsx` by rendering `ArtifactsCard`, `FolderCard`, `FilesCard`, and `AiConfigCard` in a `flex flex-col gap-4` container
