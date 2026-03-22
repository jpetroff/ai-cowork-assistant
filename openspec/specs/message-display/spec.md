# Spec: Message Display

## Requirements

### Requirement: Message store loads messages for the active conversation
The system SHALL load all messages for the active conversation from SQLite into `messageStore` when the chat route loader runs. Components read exclusively from the store.

#### Scenario: Messages load on chat navigation
- **WHEN** the user navigates to `/projects/:projectId/chats/:chatId`
- **THEN** the route loader calls `messageStore.loadForConversation(chatId)` and the store's `messages` array is populated in ascending `sequence_order`

#### Scenario: Empty conversation shows empty state
- **WHEN** `messageStore.messages` is empty and `status` is `'ready'`
- **THEN** the chat column displays an empty state prompt ("Send a message to get started")

#### Scenario: Store is cleared on conversation switch
- **WHEN** the user navigates to a different chat
- **THEN** `messageStore.clear()` is called before loading the new conversation's messages

---

### Requirement: User messages are persisted and displayed
The system SHALL create a message row in SQLite with `role: 'user'` whenever the user submits the chat input or an `initialMessage` is present in router state, and immediately display it in the message list.

#### Scenario: User submits chat input
- **WHEN** the user types in the chat input and presses Send or Cmd/Ctrl+Enter
- **THEN** `messageStore.addUserMessage(content)` is called, a `role: 'user'` row is inserted into SQLite with the next `sequence_order`, and the message appears in the list immediately

#### Scenario: initialMessage from router state is sent on mount
- **WHEN** the chat page mounts with `location.state.initialMessage` set
- **THEN** `messageStore.addUserMessage(initialMessage)` is called once, the router state is cleared to prevent replay, and the message appears as the first item in the list

#### Scenario: Empty input is rejected
- **WHEN** the user submits an empty or whitespace-only chat input
- **THEN** no message is created and the input remains focused

---

### Requirement: Message list auto-scrolls to the latest message
The system SHALL scroll the message list to the bottom whenever a new message is added or streaming content grows.

#### Scenario: New user message triggers scroll
- **WHEN** a user message is added to `messageStore.messages`
- **THEN** the message list scrolls to the bottom smoothly

#### Scenario: Streaming content triggers scroll
- **WHEN** `messageStore.streamingContent` updates during an AI response
- **THEN** the message list scrolls to keep the streaming bubble visible

---

### Requirement: Streaming state is represented in the message list
The system SHALL display a streaming bubble when `messageStore.isStreaming` is true, showing accumulated content as it arrives.

#### Scenario: Streaming bubble appears during AI response
- **WHEN** `messageStore.isStreaming` is `true`
- **THEN** a streaming bubble is displayed below the last message showing `streamingContent` and an animated indicator

#### Scenario: Streaming bubble disappears on completion
- **WHEN** `messageStore.finalizeStreaming()` is called
- **THEN** the streaming bubble is replaced by the finalized assistant message bubble

#### Scenario: No streaming bubble when idle
- **WHEN** `messageStore.isStreaming` is `false`
- **THEN** no streaming bubble is rendered

---

### Requirement: Chat column width is resizable and persisted
The system SHALL allow the user to drag the divider between the chat column and editor panel to resize the chat column, and SHALL persist the chosen width to `AppSetting`.

#### Scenario: Drag handle resizes the column live
- **WHEN** the user drags the handle between the chat column and editor panel
- **THEN** the chat column width updates in real time, constrained between 240px and 560px

#### Scenario: Width is persisted on drag end
- **WHEN** the user releases the drag handle
- **THEN** the final width is written to `AppSetting` key `chat_column_width`

#### Scenario: Width is restored on next visit
- **WHEN** the app loads and `AppSetting` key `chat_column_width` exists
- **THEN** the chat column renders at the saved width instead of the default 320px
