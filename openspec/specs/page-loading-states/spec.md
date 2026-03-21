### Requirement: Store slices expose a four-state status enum
Every Zustand store slice that performs async data loading SHALL expose a `status` field typed as `'idle' | 'loading' | 'ready' | 'error'`. The initial value SHALL be `'idle'`.

#### Scenario: Status starts idle
- **WHEN** a store is initialized before any load action is called
- **THEN** `store.status === 'idle'`

#### Scenario: Status covers all transitions
- **WHEN** a load action is in progress
- **THEN** `store.status === 'loading'`
- **WHEN** the load action completes successfully
- **THEN** `store.status === 'ready'`
- **WHEN** the load action fails with an error
- **THEN** `store.status === 'error'`

### Requirement: Load actions set status synchronously before any await
Every store load action SHALL set `status: 'loading'` and clear stale data as its **first synchronous operation**, before any `await` or Promise call. This SHALL be the contract for all store implementations.

#### Scenario: Stale data is cleared before async work begins
- **WHEN** a load action is called (e.g., `messageStore.loadForConversation(newId)`)
- **THEN** `store.status` is `'loading'` and `store.messages` is `[]` synchronously, before the DB query resolves
- **AND** a component subscribed to `store.messages` will never display data from a previous navigation target

#### Scenario: Rapid re-navigation does not flash stale data
- **WHEN** the user navigates from Project A's chat to Project B's chat in quick succession
- **THEN** Project A's messages are never visible while Project B's messages are loading

### Requirement: Components render their own skeleton based on their slice's status
Each component that subscribes to a store slice SHALL check that slice's `status` field and render a skeleton placeholder when `status === 'loading'`, an error state when `status === 'error'`, and real content when `status === 'ready'`. Page-level components SHALL NOT aggregate loading state from child slices.

#### Scenario: Component shows skeleton while loading
- **WHEN** a component mounts and its store slice has `status === 'loading'`
- **THEN** the component renders a skeleton UI (shimmer placeholder) instead of real content

#### Scenario: Components on the same page load independently
- **WHEN** navigating to the chat page and `messageStore.status` becomes `'ready'` before `artifactStore.status`
- **THEN** `MessageList` renders real messages while `EditorPanel` still shows its skeleton

#### Scenario: Component shows error state on failure
- **WHEN** a store slice has `status === 'error'`
- **THEN** the subscribed component renders an error indicator, not a skeleton or real content

### Requirement: Page components are layout shells with no loading logic
Route-level page components (`HomePage`, `ProjectPage`, `ChatPage`) SHALL NOT check any `status` field themselves. They SHALL render layout components that each own their own loading state. This keeps page files thin and prevents loading logic from appearing at the wrong layer.

#### Scenario: ChatPage renders layout without status check
- **WHEN** `ChatPage` renders
- **THEN** it returns its layout structure directly without any `if (status === 'loading')` guard
- **AND** child components (`MessageList`, `EditorPanel`, `ConversationSidebar`) each handle their own status independently
