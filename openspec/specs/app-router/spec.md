### Requirement: Hash-based route tree covering all application sections
The application SHALL use `createHashRouter` from `react-router-dom` to define a route tree with exactly five routes: `/loading`, `/setup`, `/` (home), `/projects/:projectId`, and `/projects/:projectId/chats/:chatId`. All routes SHALL be nested under a shared `AppShell` layout component via `<Outlet />`.

#### Scenario: All routes are navigable
- **WHEN** the application renders with the router mounted
- **THEN** navigating to `/#/`, `/#/setup`, `/#/loading`, `/#/projects/some-id`, and `/#/projects/some-id/chats/some-chat-id` each renders the corresponding page component without a blank screen or unhandled error

#### Scenario: Hash URLs work without server configuration
- **WHEN** the Tauri WebView loads the application
- **THEN** all routes resolve correctly using hash-based navigation without any asset protocol or server-side routing configuration

### Requirement: AppShell wraps all routes as shared layout
The `AppShell` component SHALL render as the root layout element for all routes, providing a navigation progress indicator and an `<Outlet />` for child route content.

#### Scenario: Progress indicator during loader execution
- **WHEN** a route navigation triggers a loader
- **THEN** `AppShell` displays a visual progress indicator (e.g., thin progress bar) for the duration of the loader's synchronous execution, then hides it when `useNavigation().state === 'idle'`

#### Scenario: Child route renders inside shell
- **WHEN** any route is active
- **THEN** its page component renders inside the `AppShell` layout without replacing it

### Requirement: App entry point wires router and triggers boot sequence
`App.tsx` SHALL render `<RouterProvider router={router} />` and contain exactly one `useEffect` that calls `appStore.init()` to trigger the application boot sequence.

#### Scenario: Router is mounted on first render
- **WHEN** `ReactDOM.createRoot(...).render(<App />)` is called
- **THEN** the `RouterProvider` is mounted and the current hash URL determines the active route

#### Scenario: Boot sequence fires once
- **WHEN** `App` mounts
- **THEN** `appStore.init()` is called exactly once via `useEffect(fn, [])`

### Requirement: Route loaders dispatch store actions without awaiting
Each route with data dependencies SHALL have a `loader` function that calls the appropriate store actions to initiate loading and returns `null` synchronously. Loaders SHALL NOT use `async/await`.

#### Scenario: Home route loader fires project load
- **WHEN** the user navigates to `/#/`
- **THEN** the loader calls `projectStore.loadAll()` and returns `null` without awaiting it

#### Scenario: Project route loader fires conversation load
- **WHEN** the user navigates to `/#/projects/:projectId`
- **THEN** the loader calls `projectStore.setActive(projectId)` and `conversationStore.loadForProject(projectId)`, then returns `null` synchronously

#### Scenario: Chat route loader fires message and artifact loads
- **WHEN** the user navigates to `/#/projects/:projectId/chats/:chatId`
- **THEN** the loader calls `conversationStore.setActive(chatId)`, `messageStore.loadForConversation(chatId)`, and `artifactStore.loadForConversation(chatId)`, then returns `null` synchronously
