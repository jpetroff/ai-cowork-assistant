## 1. Rust Backend — system.rs commands

- [x] 1.1 Create `src-tauri/src/commands/system.rs` with `get_os_username` command reading USER / USERNAME / LOGNAME env vars in order, returning empty string on failure
- [x] 1.2 Add `get_os_avatar_path` command in `system.rs`: on macOS scan `~/Library/Application Support/com.apple.AccountPicture.storage/` for a JPEG/PNG matching the current user, return `Option<String>`; return `None` on all other platforms
- [x] 1.3 Register `system.rs` as a module in `src-tauri/src/lib.rs` (add `mod commands::system`) and add both commands to `.invoke_handler()`

## 2. Rust Backend — dev reset command

- [x] 2.1 Create `src-tauri/src/commands/dev.rs` with `clear_app_data` command under `#[cfg(debug_assertions)]` that resolves `app_data_dir()`, removes it recursively, then calls `std::process::exit(0)`
- [x] 2.2 Register `dev.rs` in `lib.rs` with conditional compilation (`#[cfg(debug_assertions)] mod commands::dev;`) and add `clear_app_data` to the invoke handler under the same cfg guard

## 3. appStore — setupDefaults and OS pre-population

- [x] 3.1 Add `setupDefaults: { name: string; avatarPath: string | null } | null` field to the `AppState` interface in `appStore.ts`, initialized to `null`
- [x] 3.2 In `appStore.init()`, when `isFirstRun === true`, invoke `get_os_username` and `get_os_avatar_path` concurrently (`Promise.all`) and set `setupDefaults` before setting `appPhase` to `'setup'`; catch errors and fall back to `{ name: '', avatarPath: null }`

## 4. SetupWizard component — step shell and stepper

- [x] 4.1 Create `src/components/setup/WizardStepper.tsx` — a minimal step indicator (numbered dots + labels for "Profile", "LLM Provider", "Done") that accepts `currentStep: 1 | 2 | 3`
- [x] 4.2 Create `src/components/setup/SetupWizard.tsx` as the main orchestrator: manages `currentStep` state, renders `WizardStepper` and the active step component, passes submit handlers to each step

## 5. Profile step (Step 1)

- [x] 5.1 Create `src/components/setup/ProfileStep.tsx` — renders a name input pre-filled from `appStore.setupDefaults.name`, an avatar preview (`<img>` via asset:// when path available, initials circle otherwise), and a "Continue" button
- [x] 5.2 Add inline validation: "Continue" button is disabled and an error is shown if the name input is empty on submit
- [x] 5.3 On submit, call `upsertSetting('user_profile', JSON.stringify({ name, avatarPath }))` via the DB API before advancing the wizard step

## 6. LLM Provider step (Step 2)

- [x] 6.1 Create `src/components/setup/ProviderStep.tsx` — provider type selector (`ollama` / `openai` / `custom`), base URL input, conditional API key input (hidden for ollama), "Test Connection" button, and "Continue" button
- [x] 6.2 Implement the Test Connection handler: fetch `GET {baseUrl}/models` with `Authorization: Bearer {apiKey}` header if present, 5 s timeout; show success badge on 200 or inline error on failure
- [x] 6.3 On submit, call `createLlmProvider({ name, providerType, baseUrl, apiKey, isDefault: true })` via the DB API, then advance to step 3 and call `appStore.onSetupComplete()`

## 7. Done step (Step 3)

- [x] 7.1 Create `src/components/setup/DoneStep.tsx` — displays a success message and a loading indicator tied to `appStore.sidcarStatus`; if sidecar is already `'ready'`, show a "Go to app" message; if still loading, show "Starting AI engine…"

## 8. Dev reset button

- [x] 8.1 In `SetupPage.tsx` (or `SetupWizard.tsx` footer), conditionally render a "Reset App Data" button when `import.meta.env.DEV` is true
- [x] 8.2 Add a confirmation dialog (shadcn `AlertDialog`) before the reset: "This will delete all local data. Continue?" → on confirm, call `invoke('clear_app_data')`

## 9. Wire up SetupPage

- [x] 9.1 Replace the stub content in `src/pages/SetupPage.tsx` with `<SetupWizard />`, importing from `@/components/setup/SetupWizard`
- [x] 9.2 Verify the router already has a `/setup` route pointing to `SetupPage` and that `AppShell` navigates there when `appPhase === 'setup'` (check `app-router` spec; add navigation logic if missing)

## 10. Tauri capabilities and permissions

- [x] 10.1 Add `os:default` capability to `src-tauri/capabilities/default.json` if not already present (needed by `@tauri-apps/plugin-os` for the asset:// protocol for avatar images)
- [x] 10.2 Ensure `asset` protocol scope in capabilities allows reading from `~/Library/Application Support/com.apple.AccountPicture.storage/` on macOS for avatar display
