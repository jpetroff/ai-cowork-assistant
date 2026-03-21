## ADDED Requirements

### Requirement: Two Tauri windows defined statically — splash and main
The application SHALL define exactly two windows in `tauri.conf.json`: `"splash"` (400×400, no decorations, non-resizable, centered, visible on start) and `"main"` (default 1200×800, min 800×600, resizable, hidden on start). Both windows load the same `index.html` entry point.

#### Scenario: Splash is visible at app launch
- **WHEN** the Tauri application starts
- **THEN** the splash window is visible at 400×400 with no title bar or window chrome

#### Scenario: Main window is hidden at app launch
- **WHEN** the Tauri application starts
- **THEN** the main window exists but is not visible to the user

#### Scenario: Both windows load the same React app
- **WHEN** either window opens
- **THEN** the same React application bundle is loaded; `AppShell` uses `getCurrentWindow().label` to determine window-specific behavior

---

### Requirement: AppShell routes rendering based on window label
`AppShell` SHALL call `getCurrentWindow().label` once on mount and store the result. If the label is `"splash"`, it SHALL always render `<LoadingPage />` regardless of the router state. If the label is `"main"`, it SHALL render `<Outlet />` with a `LoadingPage` overlay guard when `appPhase === 'loading'`.

#### Scenario: Splash window always renders LoadingPage
- **WHEN** `AppShell` mounts in the splash window
- **THEN** it renders `<LoadingPage />` unconditionally, ignoring the React Router `<Outlet />`

#### Scenario: Main window renders loading overlay during loading phase
- **WHEN** `AppShell` mounts in the main window AND `appPhase === 'loading'`
- **THEN** it renders `<LoadingPage />` as a fullscreen overlay instead of `<Outlet />`

#### Scenario: Main window renders normal app when ready
- **WHEN** `appPhase === 'ready'` in the main window
- **THEN** `AppShell` renders `<Outlet />` and the router-selected page is visible

---

### Requirement: Boot completion triggers splash close and main window show
When `appStore.appPhase` transitions to `'ready'`, the system SHALL: (1) navigate the main window to the correct route (`/` or `/setup` is already set), (2) show the main window at its restored or default size, (3) close the splash window.

#### Scenario: Main window opens to correct route on ready
- **WHEN** `appPhase` transitions to `'ready'`
- **THEN** the main window is shown and displays either `HomePage` or `SetupPage` with no visible intermediate navigation

#### Scenario: Splash closes after main is shown
- **WHEN** `appPhase` transitions to `'ready'`
- **THEN** the splash window closes after the main window is visible (preventing a momentary dark screen)

#### Scenario: First run opens main at setup route
- **WHEN** `appPhase` transitions to `'ready'` after a first-run boot
- **THEN** the main window is shown at the `/setup` route

---

### Requirement: Main window size is persisted and restored
The system SHALL store the main window's last known dimensions in `app_settings` under keys `main_window_width` and `main_window_height`. Before showing the main window, the boot sequence SHALL read these values and resize the window accordingly. The system SHALL update these values whenever the user resizes the main window, debounced at 500ms.

#### Scenario: Window opens at last remembered size
- **WHEN** the user has previously resized the main window and relaunches the app
- **THEN** the main window opens at the previously saved dimensions

#### Scenario: Default size on first launch
- **WHEN** `main_window_width` and `main_window_height` are not set in `app_settings`
- **THEN** the main window opens at 1200×800

#### Scenario: Resize persists after debounce
- **WHEN** the user resizes the main window and stops resizing
- **THEN** within 500ms the new dimensions are written to `app_settings`

#### Scenario: Minimum size is enforced
- **WHEN** the stored dimensions are smaller than 800×600
- **THEN** the window opens at the minimum size (800×600) instead

---

### Requirement: DB name is consistent between Rust and Tauri config
The SQLite database SHALL be referenced as `sqlite:app_data.db` in both `tauri.conf.json` (plugins.sql.preload) and `src-tauri/src/db.rs`. The current mismatch (`user_data.db` in config vs `app_data.db` in Rust) SHALL be resolved in favor of `app_data.db`.

#### Scenario: DB preload matches Rust constant
- **WHEN** the Tauri application starts
- **THEN** the SQL plugin preloads `sqlite:app_data.db`, which matches `DB_NAME` in `db.rs`
