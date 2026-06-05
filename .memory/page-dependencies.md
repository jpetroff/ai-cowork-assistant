# Page Dependencies

This map documents the main object graph that drives each page and the cross-page dependencies that matter for revision/chat behavior.

## AppShell

- Main components: `AppShell`, route `Outlet`, `LoadingPage`.
- Driving stores: `appStore` for `appPhase`; React Router `useNavigation()` for route loading state.
- External dependencies: Tauri window label helpers determine splash vs main-window behavior.
- Needs from others: child routes must have their loader-owned stores ready enough to render independently.
- Architectural notes: navigation side effects currently live in component `useEffect`; this is accepted local drift from the older "all effects in stores/loaders" spec.

## SetupPage

- Main components: `SetupPage`, `SetupWizard`, setup step components.
- Driving stores: `appStore` supplies first-run defaults and setup completion flow; provider/settings stores are used by setup steps.
- External dependencies: Tauri OS/window helpers and sidecar startup state from app initialization.
- Needs from others: app phase must move from `setup` to `ready` after setup completes.
- Architectural notes: keep setup isolated from project/chat stores so first-run work does not preload normal workspace state.

## HomePage

- Main components: `HomePage`, `ProjectList`, `ProjectCard`.
- Driving stores: `projectStore`; route loader calls `projectStore.loadAll()`.
- External dependencies: project repository through `projectStore`.
- Needs from others: project creation navigates to `ProjectPage`; no artifact/chat state should be required.
- Architectural notes: page remains thin; retry behavior lives in `ProjectList` through `projectStore.loadAll()`.

## ProjectPage

- Main components: `ProjectHeader`, `NewTaskInput`, `CreateEmptyChatButton`, `ConversationList`, `ArtifactsCard`, `FolderCard`, `FilesCard`, `AiConfigCard`.
- Driving stores: `projectStore` for active project, `conversationStore` for chat list/create/active conversation, `backgroundGenerationStore` for project-page task generation, `projectSettingsStore` and `llmProviderStore` for AI config.
- External dependencies: artifact preview calls `listArtifactsByProject()` directly; AI config uses provider/model repositories through stores.
- Needs from others: `NewTaskInput` creates a conversation, starts `backgroundGenerationStore.startMessage({ artifactContext: null })`, then navigates to `ChatPage`; `CreateEmptyChatButton` creates a conversation and navigates without messages or generation.
- Architectural notes: `ArtifactsCard` has local fetching effects instead of a store-backed loader; acceptable now, but it is the main dashboard-side inconsistency.

## ChatPage

- Main components: `ChatPage`, `ChatLayout`, `ChatColumn`, `MessageList`, `ChatInput`, `EditorSection`, `ArtifactTitleBar`, `EditorPanel`, `RevisionPicker`.
- Driving stores: `conversationStore` owns active conversation; `chatSessionStore` coordinates route loading and chat submits; `messageStore` owns visible messages; `artifactStore` owns active artifact, revisions, editor content, loaded revision, and editable revision; `backgroundGenerationStore` owns active generation jobs; `sidecarStore` handles transport parsing.
- External dependencies: route loader sets active project/conversation and starts `messageStore.loadForConversation()` plus `artifactStore.loadForConversation()` independently; sidecar HTTP streaming persists assistant messages and AI revisions.
- Needs from others: chat revision cards need `artifactStore.loadedRevisionId` to highlight the editor-open revision; editor and chat both call `artifactStore.requestRevisionLoad(revisionId)` to select a revision.
- Architectural notes: `loadedRevisionId` is UI/open-document state, while `editableRevisionId` is save-chain state. Do not use editability state to highlight chat cards.

## Revision Selection Contract

- `artifactStore.loadForConversation(conversationId)` should honor `conversations.active_artifact_id`; if missing/stale, fall back to the most recently updated artifact.
- `artifactStore.requestRevisionLoad(revisionId)` is the only revision-selection action used by chat cards and editor history.
- Loading a head revision sets `loadedRevisionId`; `editableRevisionId` is set only for an unsealed user draft.
- Loading a historical revision sets `loadedRevisionId` to the selected revision and `editableRevisionId` to `null`, so the next edit creates a user draft.
- Chat send uses the loaded historical revision when editing is detached from head.
- Loading or creating a different artifact persists `conversations.active_artifact_id` so reopening the chat restores the latest open document.
