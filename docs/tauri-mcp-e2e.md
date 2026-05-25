# Tauri MCP E2E Harness

Run the local macOS-oriented Tauri MCP smoke flow with:

```sh
bun run e2e:tauri:mcp
```

The harness starts `TAURI_MCP=1 bun run tauri dev`, connects to the debug MCP bridge on port `9223`, and drives the app through the MCP CLI with structured JSON output. It verifies:

- the backend state belongs to `asc.evgn.aicoworklab`
- the `main` window exists
- the first-run setup screen renders
- keyboard/click automation can complete the profile step
- the provider setup controls are interactive
- console logs do not contain errors

Each run uses a temporary `HOME` so the Tauri SQLite app data is isolated from the developer profile. Artifacts are written under `e2e-artifacts/tauri-mcp/<run-id>/`, including the MCP transcript and Tauri dev logs. On failure, the runner also captures a screenshot, accessibility snapshot, console logs, and IPC capture payload.

Useful environment variables:

- `TAURI_MCP_PORT=9223` changes the bridge port the runner waits for.
- `TAURI_E2E_TIMEOUT_MS=120000` changes the startup timeout.
- `TAURI_MCP_CLI_BIN=/path/to/tauri-mcp` uses a preinstalled CLI instead of `bunx @hypothesi/tauri-mcp-cli`.

The runner intentionally fails if port `9223` or `1420` is already in use, because driving an existing app or dev server would make the result non-deterministic.
