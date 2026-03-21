## Why

The application has no boot sequence — it renders the home page immediately on load with no initialization, no sidecar startup, and no first-run detection. A structured boot sequence is needed to start the Python sidecar, verify it is healthy, detect first-run state, and route the user to the correct page — all with minimal perceived latency and no visible intermediate transitions.

## What Changes

- Add a **splash window** (400×400, no decorations) as the app's initial entry point, replacing the current single unsized window
- Add a **main window** (min 800×600, hidden at startup) that opens only when boot is complete
- Implement `appStore` as a Zustand store with a typed `AppPhase` enum driving all window and route decisions
- Implement `appStore.init()` as the boot coordinator: invoke sidecar, poll health check, check DB for first-run state
- Add a `LoadingPage` component used in both the splash window (fullscreen) and as a main-window overlay during post-setup sidecar wait
- Add startup step model to `appStore` for extensible progress display (sidecar today; ChromaDB, external services in future)
- Persist main window dimensions in `app_settings` and restore them at startup
- Update `AppShell` to branch on window label: splash renders `LoadingPage` always; main renders `<Outlet />` with loading overlay guard

## Capabilities

### New Capabilities

- `app-boot`: Application boot sequence — `AppPhase` state machine, `appStore` contract, sidecar lifecycle (Tauri starts unconditionally, React health-checks), startup step model, first-run detection, boot error handling and retry
- `window-management`: Two-window Tauri model (splash + main), window size persistence in `app_settings`, window show/hide/close lifecycle tied to `AppPhase` transitions

### Modified Capabilities

- `app-router`: `AppShell` gains window-label awareness; routes `/loading` and `/setup` get updated navigation contracts driven by `AppPhase` rather than direct navigation

## Impact

- **`src-tauri/tauri.conf.json`**: Add splash window definition (400×400, no decorations, visible); set main window `visible: false`
- **`src-tauri/src/sidecar.rs`**: Sidecar `init` command unchanged in contract; health check moves to React side
- **`src/stores/appStore.ts`**: New Zustand store (replaces stub)
- **`src/components/layout/AppShell.tsx`**: Window-label branching
- **`src/pages/LoadingPage.tsx`**: Rewritten to render startup steps + error state
- **`src-tauri/src/db.rs`**: Two new `app_settings` seeds: `main_window_width`, `main_window_height`
- **Dependencies**: `@tauri-apps/api` (window management — already available via Tauri v2)
