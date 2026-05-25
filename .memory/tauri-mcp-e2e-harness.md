# Tauri MCP E2E Harness

This project has a first real running-app E2E harness at `scripts/e2e/tauri-mcp.ts`, exposed through:

```sh
bun run e2e:tauri:mcp
```

Use this when a test must exercise the actual Tauri desktop shell, native windows, Tauri plugins, Rust commands, SQLite app data, or the real WebView. Keep Vitest/Testing Library for component and store-level tests.

## Implementation Shape

- The package script `e2e:tauri:mcp` runs the TypeScript file directly with Bun.
- The runner starts `TAURI_MCP=1 bun run tauri dev`, which runs Tauri in debug mode and triggers `beforeDevCommand` from `src-tauri/tauri.conf.json`.
- The runner sets `TAURI_DEV_HOST=127.0.0.1` by default so Vite binds an explicit loopback address instead of `::1`.
- The runner creates a temporary isolated `HOME`; this keeps Tauri app data, including `sqlite:app_data.db`, away from the developer's real profile.
- The runner waits for TCP port `9223`, then calls `bunx @hypothesi/tauri-mcp-cli` commands with `--json` and parses stdout into a transcript.
- The Tauri app process is started as a detached process group via Node `child_process.spawn`, not `Bun.spawn`, so cleanup can terminate the whole `tauri dev` tree, including Vite and the app binary.
- Artifacts are written under `e2e-artifacts/tauri-mcp/<run-id>/`; `.gitignore` excludes this directory.

## Required Project Wiring

- `src-tauri/src/lib.rs` registers `tauri_plugin_mcp_bridge::init()` only in debug builds and only when `TAURI_MCP=1`.
- `src-tauri/tauri.conf.json` has `app.withGlobalTauri: true`, which the MCP bridge needs for WebView communication.
- `src-tauri/capabilities/default.json` includes `mcp-bridge:default`.
- `package.json` has `@hypothesi/tauri-plugin-mcp-bridge` and `src-tauri/Cargo.toml` has `tauri-plugin-mcp-bridge`.
- The sidecar binary must be available for local `tauri dev`, because app boot invokes it before setup/ready flows settle.

## Current Scenario Coverage

The initial scenario is intentionally a smoke plus first-run interaction:

- fail fast if ports `9223` or `1420` are already in use
- start the debug Tauri app with MCP enabled
- connect `driver-session start`
- assert backend state contains `asc.evgn.aicoworklab`
- assert `manage-window --action list` includes the `main` window
- start IPC monitoring
- wait for first-run setup text: `Welcome! What's your name?`
- capture and assert an accessibility snapshot includes setup controls
- focus and type into `#profile-name`
- click the profile `Continue` button
- wait for provider setup text: `Connect an AI provider`
- click `Custom (OpenAI-compatible)`
- type into `#provider-url`
- assert console logs do not contain `error`, `exception`, or `unhandled`
- stop the MCP session and terminate the Tauri dev process group

Failure artifacts include:

- `tauri-dev.log`
- `transcript.json`
- `failure.png`
- accessibility snapshot output
- console logs
- IPC capture output

## Adding New E2E Tests

Prefer extending the runner with small scenario functions instead of adding ad hoc shell scripts. Keep the structure deterministic:

1. Add a helper or scenario function inside `scripts/e2e/tauri-mcp.ts`.
2. Use explicit MCP CLI commands and flags, not natural-language instructions.
3. Wait for stable UI state with `webview-wait-for` before clicking or typing.
4. Prefer semantic text, roles from accessibility snapshots, stable ids, or explicit selectors already present in UI code.
5. Assert through structured or textual MCP output using `allText(...)`.
6. On failures, let the shared `catch` path capture screenshot, DOM snapshot, logs, and IPC data.
7. Keep test data inside the isolated temp `HOME`; do not rely on a developer's existing app database.

Good command patterns:

```ts
await runCli(['webview-wait-for', '--type', 'text', '--value', 'Some text', '--window-id', 'main', '--timeout', '15000', '--json'])
await runCli(['webview-interact', '--action', 'click', '--selector', 'Continue', '--strategy', 'text', '--window-id', 'main', '--json'])
await runCli(['webview-keyboard', '--action', 'type', '--selector', '#some-input', '--text', 'value', '--window-id', 'main', '--json'])
await runCli(['webview-execute-js', '--window-id', 'main', '--script', "(() => document.title)()", '--json'])
```

Important CLI behavior learned during implementation:

- Some MCP CLI commands expose `--raw`, but commands such as `manage-window` still require first-class flags like `--action`; prefer explicit flags.
- `webview-keyboard --action type` requires both `--selector` and `--text`, even if an element was focused earlier.
- `webview-execute-js` should use an IIFE when returning a value.
- `bunx @hypothesi/tauri-mcp-cli` may write to temp/cache directories, so local sandboxed runs can fail even when the harness works normally.

## Choosing What To Test Here

Use this harness for flows that need real Tauri behavior:

- app boot and splash/main window transitions
- first-run setup and SQLite-backed onboarding
- Tauri command invocation and IPC monitoring
- shell/sidecar behavior
- native window behavior
- console/log regressions in the actual WebView

Do not move ordinary component tests here. Component rendering, store transitions, repository logic, and pure data transformations should stay in Vitest because they are faster and more precise.

## Running And Troubleshooting

Run:

```sh
bun run e2e:tauri:mcp
```

Useful environment variables:

- `TAURI_MCP_PORT=9223` changes the bridge port the runner waits for.
- `TAURI_E2E_TIMEOUT_MS=120000` changes the startup timeout.
- `TAURI_MCP_CLI_BIN=/path/to/tauri-mcp` uses a preinstalled CLI instead of `bunx @hypothesi/tauri-mcp-cli`.

If the runner fails before startup:

- Check whether another app is using `9223` or `1420`; the harness intentionally refuses to drive unknown existing processes.
- Read `e2e-artifacts/tauri-mcp/<run-id>/tauri-dev.log`.
- If Vite cannot bind localhost inside a sandbox, rerun outside the sandbox; the test needs real localhost listeners and a GUI app.

If an interaction fails:

- Inspect `transcript.json` first; it records every CLI command, stdout, stderr, parsed JSON, and duration.
- Inspect `failure.png` and the captured accessibility snapshot to confirm what the WebView rendered.
- Use `webview-dom-snapshot --type accessibility` while developing a new flow to choose stable text/selectors.

## Verification Commands

After changing the harness or adding scenarios, run:

```sh
bun build scripts/e2e/tauri-mcp.ts --target=bun --outdir=/private/tmp/ai-cowork-e2e-build-check
bunx tsc --noEmit
bun run test
bun run e2e:tauri:mcp
```

The E2E run may require unsandboxed execution because it starts local listeners, opens the Tauri app, and uses the MCP CLI cache/temp directories.
