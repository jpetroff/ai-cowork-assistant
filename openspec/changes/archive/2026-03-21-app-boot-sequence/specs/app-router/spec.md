## MODIFIED Requirements

### Requirement: AppShell wraps all routes as shared layout
The `AppShell` component SHALL render as the root layout element for all routes. Its behavior SHALL differ based on the Tauri window label obtained from `getCurrentWindow().label`:
- In the `"splash"` window: always render `<LoadingPage />` fullscreen, ignoring `<Outlet />`
- In the `"main"` window: render a navigation progress indicator and `<Outlet />` for child route content, except when `appStore.appPhase === 'loading'`, in which case render `<LoadingPage />` as a fullscreen overlay

#### Scenario: Progress indicator during loader execution
- **WHEN** a route navigation triggers a loader in the main window
- **THEN** `AppShell` displays a visual progress indicator (e.g., thin progress bar) for the duration of the loader's synchronous execution, then hides it when `useNavigation().state === 'idle'`

#### Scenario: Child route renders inside shell
- **WHEN** any route is active in the main window and `appPhase === 'ready'`
- **THEN** its page component renders inside the `AppShell` layout without replacing it

#### Scenario: Splash window ignores router outlet
- **WHEN** `AppShell` mounts in the splash window
- **THEN** `<LoadingPage />` is rendered regardless of the current hash URL

#### Scenario: Main window shows loading overlay during boot loading phase
- **WHEN** `AppShell` mounts in the main window and `appPhase === 'loading'`
- **THEN** `<LoadingPage />` is rendered as a fullscreen overlay, hiding the router outlet

---

### Requirement: App entry point wires router and triggers boot sequence
`App.tsx` SHALL render `<RouterProvider router={router} />` and contain exactly one `useEffect` that calls `appStore.init()` to trigger the application boot sequence. `appStore.init()` is the sole coordinator of all startup logic; `App.tsx` SHALL NOT perform any boot logic itself.

#### Scenario: Router is mounted on first render
- **WHEN** `ReactDOM.createRoot(...).render(<App />)` is called
- **THEN** the `RouterProvider` is mounted and the current hash URL determines the active route

#### Scenario: Boot sequence fires once
- **WHEN** `App` mounts
- **THEN** `appStore.init()` is called exactly once via `useEffect(fn, [])`
