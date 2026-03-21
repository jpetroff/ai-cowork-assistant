## Why

New users launching AI CoLab for the first time are dropped into an empty app with no guidance — there's no way to configure an LLM provider, no name/avatar, and no explanation of what to do next. The setup wizard fills this gap: it runs once on first launch, auto-populates what it can from the OS, and guides the user through adding at least one LLM provider before unlocking the app.

Additionally, during development, there is no ergonomic way to reset application state (clear DB, wipe app data) without manually locating OS-specific data directories — this change adds a dev-only "clear all data" escape hatch.

## What Changes

- **New**: `SetupPage` — multi-step wizard route (`/setup`) replacing the stub that currently exists
- **New**: `SetupWizard` component — step 1 (profile: name + avatar), step 2 (add LLM provider), step 3 (completion/transition)
- **New**: `ProviderForm` within setup context — inline add-provider form with provider type selector, base URL, optional API key, and model fetch/validation
- **Modified**: `appStore.init()` — reads OS username via `get_os_username` Tauri command and attempts `get_os_avatar_path`; pre-populates setup state
- **Modified**: `appStore.onSetupComplete()` — persists `user_profile` to `app_settings`, saves the first LLM provider, then transitions phase to `'loading'` or `'ready'`
- **New**: Dev-only "Clear App Data" action — available via a button in the setup wizard footer (dev builds only); calls a Rust command that deletes the app data directory (SQLite DB + ChromaDB) and restarts the app in a clean state
- **New**: Rust command `clear_app_data` — dev-mode only; resolves `$APPDATA` / `~/Library/Application Support` / `~/.local/share` via Tauri's `app_data_dir()`, deletes contents, then exits the process (Tauri will restart in dev via `tauri dev`)

## Capabilities

### New Capabilities

- `first-run-setup`: The end-to-end first-run experience: OS profile detection, multi-step setup wizard UI, LLM provider onboarding, transition to home page. Covers `SetupPage`, `SetupWizard`, profile persistence, and the `completeSetup` store action.

### Modified Capabilities

- `app-boot`: First-run detection and `init()` boot sequence now includes OS username/avatar retrieval and pre-populates setup store state. The `clear_app_data` Rust command is added (dev mode only).

## Impact

- **Frontend**: New `SetupPage.tsx`, `SetupWizard.tsx` (multi-step), inline `ProviderForm` within wizard, updated `appStore` (`completeSetup`, setup pre-population state)
- **Rust/Tauri**: New `system.rs` additions (`get_os_username`, `get_os_avatar_path` already spec'd); new `clear_app_data` command in `commands/dev.rs` (conditionally compiled with `#[cfg(debug_assertions)]`)
- **DB**: No schema changes — uses existing `app_settings` (key/value) and `llm_providers` tables
- **Router**: `/setup` route must redirect to `/` if setup is already complete; `/` must redirect to `/setup` if not
- **Dependencies**: `@tauri-apps/plugin-os@2` (already in spec); no new npm deps needed
