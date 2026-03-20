## 1. Rust Setup

- [x] 1.1 Add `tauri-plugin-sql` with `sqlite` feature to `src-tauri/Cargo.toml`
- [x] 1.2 Register `tauri-plugin-sql` in `src-tauri/src/lib.rs` Tauri builder
- [x] 1.3 Add SQL plugin capability grant for `app_data.db` to `src-tauri/capabilities/default.json`

## 2. Migration SQL

- [x] 2.1 Create `src-tauri/src/commands/db.rs` with embedded SQL string (via `include_str!()` or inline const)
- [x] 2.2 Write migration SQL: `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON`
- [x] 2.3 Add `CREATE TABLE IF NOT EXISTS projects` with UUID PK, unique name, folder_path, timestamps
- [x] 2.4 Add `CREATE TABLE IF NOT EXISTS conversations` with FK to projects (ON DELETE CASCADE) and index `idx_conv_project`
- [x] 2.5 Add `CREATE TABLE IF NOT EXISTS messages` with FK to conversations (ON DELETE CASCADE), UNIQUE(conversation_id, sequence_order), and index `idx_msg_conv`
- [x] 2.6 Add `CREATE TABLE IF NOT EXISTS artifacts` with FK to conversations (ON DELETE CASCADE), optional FK to messages (ON DELETE SET NULL), and index `idx_art_conv`
- [x] 2.7 Add `CREATE TABLE IF NOT EXISTS llm_providers` with provider_type, base_url, api_key, is_default flag
- [x] 2.8 Add `CREATE TABLE IF NOT EXISTS app_settings` with key/value TEXT columns
- [x] 2.9 Add default seed `INSERT OR IGNORE` for `theme`, `approval_mode`, `editor_autosave_interval_ms`

## 3. Rust Command

- [x] 3.1 Implement `run_migrations` Tauri command in `db.rs` that executes the migration SQL against `app_data.db`
- [x] 3.2 Register `run_migrations` command in `src-tauri/src/lib.rs` `invoke_handler`
- [x] 3.3 Add `db` module to `src-tauri/src/commands/mod.rs`

## 4. Verification

- [x] 4.1 Run `cargo build` (or `cargo tauri dev`) and confirm compilation succeeds with no errors
- [ ] 4.2 Launch the app and verify the database file (`app_data.db`) is created in the app data directory
- [ ] 4.3 Inspect the database (e.g., with `sqlite3` CLI) and confirm all six tables and indices exist
- [ ] 4.4 Confirm default `app_settings` rows are present for `theme`, `approval_mode`, `editor_autosave_interval_ms`
- [ ] 4.5 Re-launch the app and confirm `run_migrations` runs without error (idempotency check)
