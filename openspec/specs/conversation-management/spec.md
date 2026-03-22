# Spec: Conversation Management

## Requirements

### Requirement: Conversation store loads all conversations for a project
The system SHALL load all conversations belonging to a project from SQLite into the Zustand `conversationStore` when the project route loader runs, before any component renders. The loader calls `conversationStore.getState().loadForProject(projectId)`. Components read exclusively from the store.

#### Scenario: Successful load populates the store

- **WHEN** the user navigates to `/projects/:projectId`
- **THEN** the route loader calls `conversationStore.loadForProject(projectId)`, and the store's `conversations` array is populated with all conversations for that project ordered by `updated_at` DESC

#### Scenario: DB failure during load

- **WHEN** `loadForProject()` encounters a DB error
- **THEN** the store's `status` is set to `'error'` with the error message captured

#### Scenario: Navigating to a different project replaces the conversation list

- **WHEN** the user navigates from one project to another
- **THEN** `loadForProject(newProjectId)` replaces the previous project's conversations in the store

---

### Requirement: User can create a new conversation within a project
The system SHALL create a new conversation when the user submits the new-task textarea on the project home page. The conversation is inserted into SQLite; the store is updated optimistically; the user is navigated to the new chat page.

#### Scenario: Successful creation navigates to new chat

- **WHEN** `conversationStore.create(projectId)` is called
- **THEN** a new conversation row is inserted into SQLite, prepended to `store.conversations`, and the caller receives the new conversation `id` for navigation to `/projects/:projectId/chats/:id`

#### Scenario: DB failure on create shows error notification

- **WHEN** the DB insert fails
- **THEN** no conversation is added to the store and an error notification is pushed to `notificationStore`

---

### Requirement: User can rename a conversation
The system SHALL allow renaming a conversation via an inline input on the conversation list row. The rename is written to SQLite first; the store entry is updated only after DB success.

#### Scenario: Rename sets operationStates during write

- **WHEN** `conversationStore.rename(id, title)` is called
- **THEN** `operationStates[id]` is set to `'renaming'` before the DB write, and cleared on both success and failure

#### Scenario: Rename updates the store on success

- **WHEN** the DB update succeeds
- **THEN** the conversation entry in `store.conversations` is updated in place with the new title

#### Scenario: Concurrent rename is guarded

- **WHEN** `rename(id)` is called while `operationStates[id]` is already set
- **THEN** the second call is a no-op

#### Scenario: DB failure on rename shows error notification

- **WHEN** the DB update fails
- **THEN** `operationStates[id]` is cleared and an error notification is pushed to `notificationStore`

---

### Requirement: User can delete a conversation
The system SHALL allow deleting a conversation after confirming an AlertDialog. The deletion is written to SQLite first; the store entry is removed only after DB success.

#### Scenario: Delete sets operationStates during write

- **WHEN** `conversationStore.delete(id)` is called
- **THEN** `operationStates[id]` is set to `'deleting'` before the DB write, and cleared on both success and failure

#### Scenario: Delete removes the entry from the store on success

- **WHEN** the DB delete succeeds
- **THEN** the conversation is removed from `store.conversations`

#### Scenario: Concurrent delete is guarded

- **WHEN** `delete(id)` is called while `operationStates[id]` is already set
- **THEN** the second call is a no-op

#### Scenario: DB failure on delete shows error notification

- **WHEN** the DB delete fails
- **THEN** `operationStates[id]` is cleared and an error notification is pushed to `notificationStore`

---

### Requirement: Conversation store tracks the active conversation
The system SHALL maintain an `activeConversationId` field in `conversationStore`. Navigating to a chat page calls `conversationStore.setActive(chatId)`.

#### Scenario: setActive updates the store

- **WHEN** `conversationStore.setActive(id)` is called
- **THEN** `store.activeConversationId` is set to that id

#### Scenario: setActive is called by the chat route loader

- **WHEN** the user navigates to `/projects/:projectId/chats/:chatId`
- **THEN** the route loader calls `conversationStore.getState().setActive(chatId)`
