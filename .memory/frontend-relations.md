# Frontend Relations

Pages are thin; feature components and Zustand stores own behavior. Route loaders load active project/conversation state and start message/artifact loading for chat independently.

```mermaid
flowchart TD
  Main["src/main.tsx"] --> App["App"]
  App --> Router["router.tsx createMemoryRouter"]
  Router --> Shell["AppShell"]
  Shell --> Home["HomePage"]
  Shell --> Project["ProjectPage"]
  Shell --> Chat["ChatPage"]
  Shell --> Setup["SetupPage"]

  Home --> ProjectList["ProjectList -> ProjectCard"]
  Project --> ProjectCards["ProjectHeader, NewTaskInput, CreateEmptyChatButton, ConversationList, Artifacts/Files/Folder/AiConfig cards"]
  Chat --> ChatLayout["ChatLayout"]
  ChatLayout --> ChatColumn["ChatColumn"]
  ChatLayout --> EditorSection["EditorSection"]
  ChatColumn --> MessageList["MessageList"]
  ChatColumn --> ChatInput["ChatInput"]
  EditorSection --> ArtifactTitleBar["ArtifactTitleBar"]
  EditorSection --> EditorPanel["EditorPanel -> TipTap Editor"]
```

## Store Map

```mermaid
flowchart LR
  RouterLoaders["route loaders"] --> ProjectStore["projectStore"]
  RouterLoaders --> ConversationStore["conversationStore"]
  RouterLoaders --> MessageStore["messageStore"]
  RouterLoaders --> ArtifactStore["artifactStore"]

  ChatInput --> ChatSessionStore["chatSessionStore"]
  NewTaskInput["NewTaskInput"] --> ConversationStore
  NewTaskInput --> BackgroundGenerationStore["backgroundGenerationStore"]
  EmptyChat["CreateEmptyChatButton"] --> ConversationStore
  ChatInput --> ArtifactStore
  ChatSessionStore --> BackgroundGenerationStore
  BackgroundGenerationStore --> MessageStore
  BackgroundGenerationStore --> ArtifactStore
  BackgroundGenerationStore --> SidecarStore["sidecarStore"]
  EditorPanel --> ArtifactStore
  RevisionPicker["RevisionPicker"] --> ArtifactStore
```

## Page Dependency Map

See `.memory/page-dependencies.md` for the page-by-page component/store/dependency map. Main drivers:

- `AppShell`: `appStore` plus router navigation state.
- `HomePage`: `ProjectList` over `projectStore`.
- `ProjectPage`: `projectStore`, `conversationStore`, `backgroundGenerationStore` for task submission, project settings, provider/model stores, and artifact preview repositories.
- `ChatPage`: `conversationStore`, `messageStore`, `artifactStore`, and `sidecarStore`.
- `SetupPage`: setup wizard over app/provider/settings state.

## Chat and Artifact Coupling

- There is no separate `ChatStore`; chat state is `messageStore` plus `sidecarStore`.
- `backgroundGenerationStore` owns sidecar-backed generation jobs and durable user/assistant message setup.
- Project-page task submission starts background generation before navigating; empty-chat creation only creates a conversation and navigates.
- `artifactStore.loadedRevisionId` is the revision currently open in the editor and highlighted in chat/history.
- `artifactStore.editableRevisionId` is the revision that can be saved in place; `null` means the next save creates a user draft.
- `RevisionPicker` selects revisions through `artifactStore.requestRevisionLoad(revisionId)`.
- `artifactStore.loadForConversation()` honors `conversations.active_artifact_id` before falling back to the most recently updated artifact.

## Component Rules

- Prefer `src/components/ui/*` shadcn/Base UI primitives.
- Use Tailwind design tokens; do not hard-code colors.
- Keep components small and functional.
- Stores/loaders are preferred places for app side effects, though current code still has some component effects.
- Icons are mixed between lucide and Phosphor; prefer lucide for new button/icon UI unless matching nearby code.
