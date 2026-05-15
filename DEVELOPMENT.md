# Development Guide

## Prerequisites

| Tool         | Purpose                    | Install                                            |
| ------------ | -------------------------- | -------------------------------------------------- |
| Rust + Cargo | Tauri backend              | [rustup.rs](https://rustup.rs)                     |
| Bun          | Frontend + package manager | `curl -fsSL https://bun.sh/install \| bash`        |
| uv           | Python package manager     | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Python 3.11+ | FastAPI sidecar            | via uv or system                                   |

## Running for Development

The app has two independent processes that must both be running:

**Terminal 1 — Python sidecar** (start this first):

```bash
make dev-python
# equivalent: cd src-python && .venv/bin/python main.py
```

The sidecar starts a FastAPI server on `http://127.0.0.1:9720`. The Tauri dev build
hardcodes this address and does not spawn the sidecar binary itself.

**Terminal 2 — Tauri app**:

```bash
bun run tauri dev
```

This runs the Vite dev server (`bun run dev`) and the Tauri shell concurrently. The app
opens with a small splash window that transitions to the main window once the sidecar
health check passes.

### Python environment setup (first time)

```bash
cd src-python
uv venv
uv pip install -r requirements.txt
```

## Resetting Persistent State

All persistent state lives in the OS application data directory:

| Platform | Path                                                  |
| -------- | ----------------------------------------------------- |
| macOS    | `~/Library/Application Support/asc.evgn.aicoworklab/` |
| Linux    | `~/.local/share/asc.evgn.aicoworklab/`                |
| Windows  | `%APPDATA%\asc.evgn.aicoworklab\`                     |

The directory contains:

- `app_data.db` — SQLite database (projects, conversations, LLM providers, settings)
- ChromaDB vector store directory (when indexing is active)

### Option 1: In-app reset button (recommended for dev)

The setup wizard has a **Reset App Data** button in the footer — visible only in dev builds.
Clicking it confirms, deletes the app data directory, and exits the process. The Tauri
watcher restarts the app in a clean state, showing the first-run setup wizard again.

> The button appears on the `/setup` page. If the app has already completed setup,
> trigger it by manually deleting `app_data.db` (see Option 2) and restarting — this
> puts the app back into first-run mode.

### Option 2: Manual deletion

```bash
# macOS
rm -rf ~/Library/Application\ Support/asc.evgn.aicoworklab/

# Linux
rm -rf ~/.local/share/asc.evgn.aicoworklab/

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:APPDATA\asc.evgn.aicoworklab"
```

Restart the app afterwards. The database migrations run automatically on next launch.

### Option 3: Delete only the database (keep vector index)

```bash
# macOS / Linux
rm ~/Library/Application\ Support/asc.evgn.aicoworklab/app_data.db
```

This resets all app data while preserving the ChromaDB index.

## Codex Setup

Codex does not read the Claude Code settings in `.claude/`. For this project, the MCP server wiring now lives in workspace-owned files and the Codex-side approval/sandbox defaults should be added to your user config.

### Workspace MCP servers

- `.vscode/mcp.json` configures the project MCP servers for VS Code agent tooling.
- `make serena` now starts Serena with `--context codex`.
- `.mcp.json` is left in place for existing non-Codex clients that still use it.

### Codex CLI / desktop config

Per the OpenAI Codex docs, Codex CLI and the IDE extension share MCP configuration through `~/.codex/config.toml`.

Add this to `~/.codex/config.toml`:

```toml
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[mcp_servers.tauri-mcp-server]
command = "bunx"
args = ["@hypothesi/tauri-mcp-server"]

[mcp_servers.serena]
command = "uvx"
args = ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--transport", "streamable-http", "--port", "9121", "--project-from-cwd", "--context", "codex"]
startup_timeout_sec = 15
```

If you prefer CLI commands instead of editing TOML directly:

```bash
codex mcp add tauri-mcp-server -- bunx @hypothesi/tauri-mcp-server
codex mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --transport streamable-http --port 9121 --project-from-cwd --context codex
```

## Available Commands

### Bun (frontend + Tauri)

| Command               | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `bun run tauri dev`   | Run the full app in dev mode                                     |
| `bun run tauri build` | Build a production bundle                                        |
| `bun run dev`         | Vite dev server only (no Tauri shell)                            |
| `bun run build`       | Frontend production build                                        |
| `bun run test`        | Run Vitest unit tests once                                       |
| `bun run test:watch`  | Run Vitest in watch mode                                         |
| `bun run db:generate` | Regenerate TypeScript DB row types from the shared SQLite schema |
| `bun run db:check`    | Verify generated TypeScript DB row types are up to date          |

### Make

| Command           | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `make dev-python` | Start the FastAPI sidecar on port 9720                    |
| `make types`      | Regenerate Python → TypeScript types                      |
| `make serena`     | Start Serena MCP server (code intelligence for AI agents) |

### Type generation

```bash
make types
# equivalent:
#   uv run --python ./src-python/.venv/bin/python python ./src-python/generate_types.py
#   bun run db:generate
```

Run this when Python schemas (`src-python/schemas.py`) or the SQLite database schema (`src-tauri/migrations/001_initial.sql`) changes.

## Configuration

The Python sidecar is configured via environment variables (prefix `PYTHON_`) or a
`.env` file in `src-python/`:

| Variable                       | Default                             | Description               |
| ------------------------------ | ----------------------------------- | ------------------------- |
| `PYTHON_PORT`                  | `9720`                              | Sidecar HTTP port         |
| `PYTHON_API_BASE`              | `http://llama.intranet/v1`          | Default LLM API endpoint  |
| `PYTHON_DOCUMENTS_PATH`        | `./documents`                       | Local document storage    |
| `PYTHON_VECTOR_DB_PATH`        | `vector_storage.db`                 | ChromaDB persistence path |
| `PYTHON_OBSERVABILITY_ENABLED` | `true`                              | Enable Phoenix tracing    |
| `PYTHON_PHOENIX_ENDPOINT`      | `http://phoenix.intranet/v1/traces` | OTLP trace endpoint       |

## Architecture Notes

- **Splash window** — a small 400×400 window shown during boot while the sidecar health
  check runs. Transitions automatically to the main 1200×800 window.
- **First-run detection** — the app checks `llm_providers` table row count. Zero rows →
  first-run wizard; otherwise → normal boot with loading screen.
- **Dev vs. production sidecar** — in dev builds the Rust `sidecar::init` command returns
  a fixed URL (`http://127.0.0.1:9720`) without spawning a process. In production builds
  it finds a free port and spawns the bundled PyInstaller binary.
