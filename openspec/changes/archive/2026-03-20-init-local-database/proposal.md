## Why

The application needs a local SQLite database to persist all user data (projects, conversations, messages, artifacts, LLM providers, and settings). Without the database schema and migration infrastructure in place, no other feature can be built — it is the foundational data layer for the entire app.

## What Changes

- Add a Rust `run_migrations` command that initializes the SQLite database with all required tables and indices on startup
- Add the SQL migration script embedded in the Rust binary via `include_str!()`
- Add default `app_settings` seed data (theme, approval_mode, editor_autosave_interval_ms)
- Register the `tauri-plugin-sql` plugin with SQLite feature in the Tauri builder

## Capabilities

### New Capabilities
- `database-schema`: SQLite schema with all tables (projects, conversations, messages, artifacts, llm_providers, app_settings), indices, and default seed data, initialized via a Rust `run_migrations` command on startup

### Modified Capabilities

## Impact

- `src-tauri/src/commands/db.rs`: new file implementing `run_migrations`
- `src-tauri/src/lib.rs`: plugin registration + command registration
- `src-tauri/Cargo.toml`: `tauri-plugin-sql` dependency with sqlite feature
- `src-tauri/capabilities/default.json`: SQL plugin capability grant
