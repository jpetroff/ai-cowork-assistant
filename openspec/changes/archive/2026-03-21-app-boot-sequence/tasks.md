## 1. Tauri Config & Rust Fixes

- [x] 1.1 Fix DB name mismatch: change `plugins.sql.preload` in `tauri.conf.json` from `sqlite:user_data.db` to `sqlite:app_data.db`
- [x] 1.2 Add `main_window_width` (default `1200`) and `main_window_height` (default `800`) seeds to `db.rs` migration v1 `app_settings` inserts
- [x] 1.3 Add splash window to `tauri.conf.json`: label `"splash"`, 400×400, `"decorations": false`, `"resizable": false`, `"center": true`, `"visible": true`
- [x] 1.4 Update main window in `tauri.conf.json`: `"visible": false`, `"minWidth": 800`, `"minHeight": 600`

## 2. AppStore Implementation

- [x] 2.1 Create `src/stores/appStore.ts` with Zustand; define `AppPhase` type (`'booting' | 'setup' | 'loading' | 'ready' | 'error'`) and `StartupStep` interface
- [x] 2.2 Define `AppStore` state shape: `appPhase`, `startupSteps`, `sidcarStatus`, `sidcarUrl`, `sidcarError`, `bootError`, `isFirstRun`
- [x] 2.3 Implement `init()` action: call `invoke('sidecar_init')` and `listLlmProviders()` concurrently; set `isFirstRun` and transition `appPhase` to `'setup'` or `'loading'`
- [x] 2.4 Implement sidecar health-check loop in `init()`: poll `GET {sidcarUrl}/health` every 500ms, update sidecar startup step status; add 5-second "taking longer" label update; error after 15 seconds
- [x] 2.5 Implement `onSetupComplete()` action: if `sidcarStatus === 'ready'` → set `appPhase = 'ready'`; else → set `appPhase = 'loading'` and await sidecar health check completion
- [x] 2.6 Implement `retry()` action: reset `appPhase` to `'loading'`, clear `bootError`, reset failed steps to `'pending'`, re-run failed startup steps
- [x] 2.7 Enforce 300ms minimum splash display time in `init()` before allowing phase transition from `'booting'`
- [x] 2.8 Export `useAppStore` hook; remove `useAppStore` stub from `src/stores/stubs.ts`

## 3. Window Management

- [x] 3.1 Create `src/lib/windows.ts`: export `getSplashWindow()` and `getMainWindow()` helpers using `@tauri-apps/api/window`
- [x] 3.2 Implement `openMainWindow(phase: AppPhase)` in `windows.ts`: read `main_window_width`/`main_window_height` from `app_settings`, resize main window, show it
- [x] 3.3 Implement window size persistence in `windows.ts`: subscribe to main window `resize` event, debounce 500ms, write to `app_settings`; enforce minimum 800×600 on read
- [x] 3.4 Wire `appPhase === 'ready'` transition in `appStore` to call `openMainWindow()` then close splash via `getSplashWindow().close()`

## 4. AppShell & LoadingPage

- [x] 4.1 Update `AppShell.tsx`: call `getCurrentWindow().label` on mount; if `"splash"` render `<LoadingPage />` unconditionally; if `"main"` render `<LoadingPage />` overlay when `appPhase === 'loading'`, else render `<Outlet />`
- [x] 4.2 Rewrite `LoadingPage.tsx`: render app logo/name, startup step list (from `appStore.startupSteps`), and error state with Retry button when `appPhase === 'error'`; component fills its container and centers content
- [x] 4.3 Add `200ms` CSS animation delay to the startup step list so it only appears if boot takes longer than expected
- [x] 4.4 Hide startup step list entirely when `isFirstRun === true` (no steps to show on first run — splash closes almost immediately)

## 5. App.tsx & Router Wiring

- [x] 5.1 Replace the `// TODO: appStore.init()` stub in `App.tsx` with the real `useAppStore` call
- [x] 5.2 Start window size persistence listener from `App.tsx` after mount (call `startWindowSizePersistence()` from `windows.ts`)

## 6. Setup Page Integration

- [x] 6.1 Call `appStore.onSetupComplete()` from the setup wizard's submit handler when LLM provider configuration is saved

## 7. Verification

- [x] 7.1 Verify normal boot: splash opens → steps show → sidecar health OK → main opens at `/` → splash closes
- [x] 7.2 Verify first-run boot: splash opens → no steps → main opens at `/setup` → sidecar health continues in bg → on submit with ready sidecar → navigates to `/`
- [x] 7.3 Verify first-run boot (slow sidecar): setup submitted before sidecar ready → main shows loading overlay → sidecar becomes ready → overlay lifts
- [x] 7.4 Verify boot error: sidecar times out → splash shows error message and Retry button → retry restarts health check
- [x] 7.5 Verify window size persistence: resize main window → relaunch → window opens at saved dimensions
- [x] 7.6 Verify DB name consistency: app starts without "database not found" errors
