## Why

The conversation (chat) page is the primary workspace of the application — where users write, edit, and think alongside AI — but currently consists entirely of stubs. The `ChatPage` renders placeholder skeletons, `messageStore` and `artifactStore` are hardcoded to `'loading'`, and the already-implemented `ProjectEditor` component is not connected to anything. Users cannot do anything meaningful in the app until this page is real.

## What Changes

- Replace `ChatLayout` with a two-column layout: resizable chat column (default 320px) + flex-1 editor panel
- Implement `messageStore` (Zustand): load messages from SQLite, create user messages, track streaming state
- Implement `artifactStore` (Zustand): load/create artifacts, active artifact management, 1-second debounced auto-save
- Connect `ProjectEditor` to `artifactStore` — the editor becomes fully functional for document editing
- Add Google Docs-style artifact title above the editor (inline editable, persisted to `Artifact.title`)
- Add drag handle between the two columns; persist chosen width to `AppSetting` (`chat_column_width`)
- Update the chat route loader to load messages and artifacts on navigation
- Handle `location.state.initialMessage` (from `NewTaskInput`) by creating the first user message in SQLite
- Every new conversation automatically gets an empty "Untitled" artifact created immediately
- All chat input messages are persisted as `role: 'user'` messages in SQLite and displayed in the message list
- Leave clearly marked stub zones for: LLM streaming responses, tool call indicators, HITL approval, editor selection context, artifact version history, and file-link-to-disk

## Capabilities

### New Capabilities

- `message-display`: Render a conversation's message history (user bubbles + assistant bubbles), auto-scroll, streaming state
- `artifact-editor`: Full-screen TipTap editor wired to the active artifact — title, content, auto-save, streaming lock

### Modified Capabilities

- `conversation-management`: Conversation creation now also creates an initial empty artifact; chat route loader gains message + artifact loading

## Impact

- **New stores**: `src/stores/messageStore.ts`, `src/stores/artifactStore.ts` (replace `stubs.ts` imports)
- **Refactored**: `ChatLayout`, `MessageList`, `EditorPanel` (replace stubs with real implementations)
- **New components**: `ChatColumn`, `ChatColumnHeader`, `MessageBubble`, `ChatInput`, `EditorSection`, `ArtifactTitleBar`, `DragHandle`
- **Updated**: `conversationStore.create()` to also create initial artifact; `router.tsx` chat route loader
- **DB repositories used**: `messages`, `artifacts` (already exist, no schema changes needed)
- **App settings**: new key `chat_column_width` written/read via existing `settings` utilities
