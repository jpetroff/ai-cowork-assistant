## Context

The app uses `tauri-plugin-sql` (SQLite) for all local persistence. Currently no database schema or migration infrastructure exists. The `run_migrations` Rust command must be called once on startup (during `app.store.ts` `init()`) to create all tables and seed default settings. The migration SQL is embedded directly in the Rust binary using `include_str!()` — no external migration files at runtime.

## Goals / Non-Goals

**Goals:**
- Create all six tables with correct constraints, foreign keys, and indices
- Seed `app_settings` with defaults if the table is empty
- Enable WAL journal mode and foreign key enforcement
- Register `tauri-plugin-sql` and expose `run_migrations` as a Tauri command

**Non-Goals:**
- Versioned incremental migrations (no migration table; single idempotent `CREATE IF NOT EXISTS` script for now)
- Encryption or key management for the database file
- Any data access helpers beyond the migration command (`db.ts` typed helpers are a separate concern)

## Decisions

**Single embedded migration script over a migration table**
The app is in early incremental build-out. A single `CREATE TABLE IF NOT EXISTS` script is idempotent and sufficient. A versioned migration system (e.g., numbered SQL files with a `schema_migrations` table) adds complexity that isn't yet needed. Revisit when destructive schema changes are required.

**SQL embedded via `include_str!()` in `db.rs`**
Keeps the migration co-located with the Rust command that executes it. No runtime file I/O required — the SQL is compiled into the binary.

**WAL mode + foreign keys set via PRAGMA at migration time**
These are connection-level settings that must be set before table creation. They are included at the top of the migration SQL so they apply whenever `run_migrations` is called.

**Default settings seeded conditionally**
The seed INSERT uses `INSERT OR IGNORE` so re-running migrations on subsequent startups is safe and won't overwrite user-changed settings.

## Risks / Trade-offs

[Schema changes in future] → Until a proper migration system exists, additive column changes require a new `ALTER TABLE` statement appended to the script. Destructive changes would require a separate migration mechanism.

[Plugin capability scope] → The SQL plugin capability in `default.json` must explicitly allow the database filename (`app_data.db`). Incorrect scope will silently deny DB access.
