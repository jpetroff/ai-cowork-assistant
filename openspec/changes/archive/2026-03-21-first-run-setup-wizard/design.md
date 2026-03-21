## Context

The application already has the boot state machine (`appStore`) and the `'setup'` phase, but `SetupPage.tsx` is a stub with no implementation. The `onSetupComplete()` action exists and handles the phase transition correctly, but it neither receives nor persists any data. The Tauri backend has `sidecar.rs` and `db.rs` commands, but no `system.rs` (OS username/avatar) or dev-reset commands.

The first-run experience must:
1. Auto-detect the user's OS username (and optionally avatar) before showing the wizard
2. Walk the user through confirming their name and adding at least one LLM provider
3. Persist both pieces of data to SQLite, then hand off to the existing boot flow
4. (Dev only) Offer a way to wipe all app data and restart clean

## Goals / Non-Goals

**Goals:**
- Multi-step wizard UI with profile step + provider step + transition
- OS username pre-population via `@tauri-apps/plugin-os` (already a declared dependency)
- OS avatar detection (macOS: `~/.config/…` / AccountPicture API; graceful null on all platforms)
- Provider form: type selector (ollama / openai / custom), base URL, optional API key, "Test" button that hits `/models`
- Persist `user_profile` to `app_settings` and LLM provider to `llm_providers` table before calling `onSetupComplete()`
- Dev-only "Reset App Data" button that calls a Rust command to delete the app data dir

**Non-Goals:**
- Avatar upload / cropping — detected OS avatar only, no custom upload in this change
- Multiple providers at setup time — add one, more can be added later in settings
- Profile editing post-setup (exists in `UserProfile.tsx` settings panel, out of scope here)
- Any test coverage beyond the spec scenarios (tests added as part of a future test change)

## Decisions

### D1: Three-step wizard vs. single-page form

**Decision:** Three sequential steps — (1) Profile, (2) LLM Provider, (3) Done.

**Rationale:** The two required inputs (profile + provider) are conceptually separate. A flat single form would show 6–8 fields at once, which is overwhelming for first-run. A stepper communicates progress and lets each step have focused copy. Shadcn has no built-in stepper, so we build a minimal `WizardStepper` component (step dots + label, no heavy dep).

**Alternative considered:** Single-page collapsible sections — rejected because collapsed sections hide required fields, increasing support burden.

### D2: OS username via `@tauri-apps/plugin-os` vs. Rust command

**Decision:** Use a Rust command `get_os_username` that wraps `std::env::var("USER")` / `USERNAME` / `LOGNAME` with fallbacks.

**Rationale:** `@tauri-apps/plugin-os` provides `platform()`, `version()`, etc., but not username. The spec already declares a `get_os_username` Rust command in `commands/system.rs`. This is the correct location.

**Avatar:** macOS reads `~/Library/Application Support/com.apple.AccountPicture.storage/…` (complex, file-system scan). For MVP, use a simpler heuristic: check for a JPEG/PNG at the macOS path; return `null` on all other platforms. The avatar is displayed but not required — if null, show initials fallback.

### D3: Provider "Test" button behavior

**Decision:** The Test button calls `GET {baseUrl}/models` with the optional API key header. On 200, it shows a success badge and enables the "Continue" button. On failure, it shows the error message inline. Test is optional — the user can skip if they know the provider is configured correctly.

**Rationale:** Immediate validation feedback reduces setup frustration. The `/models` endpoint is available on all supported provider types (Ollama, OpenAI-compatible). This is also how the model list is populated post-setup (FR-LLM-007).

**Alternative considered:** Require successful test before continuing — rejected because it blocks users with non-standard setups or providers that have a different models endpoint path.

### D4: Dev reset — Rust command vs. frontend file access

**Decision:** Rust command `clear_app_data` compiled only under `#[cfg(debug_assertions)]`, using `tauri::path::app_data_dir()` to locate and delete the DB file and ChromaDB dir.

**Rationale:** The app data directory path is OS-specific (`~/Library/Application Support/<bundle-id>` on macOS, `%APPDATA%/<bundle-id>` on Windows, `~/.local/share/<bundle-id>` on Linux). Tauri already knows this path; it's the authoritative source. The frontend `@tauri-apps/plugin-fs` could also delete files, but the Rust side can do a safe delete-then-exit sequence atomically. Conditional compilation ensures the command is absent from production builds at the binary level (no capability required in production).

**Behavior:** After clearing, call `process::exit(0)`. In `tauri dev`, the process restarts automatically via the watcher.

### D5: Persisting user profile

**Decision:** Store as JSON in `app_settings` under key `user_profile`, matching the existing spec pattern (`db.getSetting("user_profile")`).

**Rationale:** Already in the spec (`init()` reads `db.getSetting("user_profile")`). No schema change needed. The profile is small (name string + optional avatar path) and doesn't need a dedicated table.

### D6: appStore additions for setup pre-population

**Decision:** Add `setupDefaults: { name: string; avatarPath: string | null } | null` to `AppState`. `init()` populates this when `isFirstRun === true` by calling the Rust `get_os_username` / `get_os_avatar_path` commands. `SetupWizard` reads from this state to pre-fill Step 1.

**Rationale:** Keeps the OS call in the store (not in the component), consistent with the "no data fetching in components" discipline.

## Risks / Trade-offs

- **Avatar detection is macOS-only and fragile** → Mitigation: always show initials fallback; the avatar path is optional everywhere; if file-system scan fails, log and return null.
- **Provider test may time out on slow machines** → Mitigation: 5 second fetch timeout on the test call; show spinner with cancel.
- **Dev reset deletes ChromaDB but ChromaDB path is inside the sidecar** → Mitigation: delete the entire `app_data_dir()` directory, which contains both the SQLite DB and the ChromaDB persistence folder (both are stored under the same root per BR-AI-001).
- **`process::exit(0)` in dev may leave orphaned sidecar** → Mitigation: `tauri dev` restarts the whole process; the sidecar is a child process and gets SIGTERM. Acceptable for dev only.

## Open Questions

- None blocking — avatar path detection can be deferred to null without impacting the spec.
