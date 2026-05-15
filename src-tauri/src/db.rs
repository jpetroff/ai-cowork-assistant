// Rust-side authoritative schema definition.
// The SQL in src-tauri/migrations/001_initial.sql is shared with the TypeScript type generator.
// When updating the schema, run `bun run db:generate` to refresh frontend row types.

use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_NAME: &str = "sqlite:app_data.db";
const INITIAL_SCHEMA: &str = include_str!("../migrations/001_initial.sql");

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial schema",
        kind: MigrationKind::Up,
        sql: INITIAL_SCHEMA,
    }]
}
