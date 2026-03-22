## MODIFIED Requirements

### Requirement: User can create a new conversation within a project
The system SHALL create a new conversation AND an initial empty artifact when the user submits the new-task textarea on the project home page. The conversation and artifact are inserted into SQLite; the store is updated optimistically; the user is navigated to the new chat page.

#### Scenario: Successful creation navigates to new chat
- **WHEN** `conversationStore.create(projectId)` is called
- **THEN** a new conversation row is inserted into SQLite, an empty artifact (version: 1, content: '', title: null) is inserted linked to that conversation, both are reflected optimistically in their stores, and the caller receives the new conversation for navigation to `/projects/:projectId/chats/:id`

#### Scenario: DB failure on create shows error notification
- **WHEN** the DB insert for either the conversation or artifact fails
- **THEN** no conversation or artifact is added to the store and an error notification is pushed to `notificationStore`

---

## ADDED Requirements

### Requirement: Chat route loader loads messages and artifacts
The system SHALL load messages and artifacts for the active conversation when navigating to the chat page, ensuring components always read from pre-populated stores.

#### Scenario: Direct navigation to chat URL loads all required data
- **WHEN** the user navigates directly to `/projects/:projectId/chats/:chatId`
- **THEN** the route loader calls `projectStore.setActive(projectId)`, `conversationStore.loadForProject(projectId)` (if not already loaded for this project), `conversationStore.setActive(chatId)`, `messageStore.loadForConversation(chatId)`, and `artifactStore.loadForConversation(chatId)` — all before any component renders

#### Scenario: Navigating between chats in the same project reuses conversations
- **WHEN** the user navigates from one chat to another within the same project
- **THEN** the loader skips `conversationStore.loadForProject()` (already loaded) but still reloads messages and artifacts for the new conversation
