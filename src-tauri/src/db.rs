use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_NAME: &str = "sqlite:app_data.db";

/*
    All table are also schemas are defined in ./prisma/scheme.prisma to automatically generate frontend types. Run bun run db:generate to update Typescript bindings
*/
pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_base_schema",
            sql: "CREATE TABLE IF NOT EXISTS configuration (key TEXT PRIMARY KEY, value TEXT);
                 CREATE TABLE IF NOT EXISTS projects (
                     id TEXT PRIMARY KEY,
                     name TEXT NOT NULL,
                     output_folder TEXT,
                     created_at INTEGER NOT NULL,
                     updated_at INTEGER NOT NULL
                 );
                 CREATE TABLE IF NOT EXISTS chats (
                     id TEXT PRIMARY KEY,
                     name TEXT NOT NULL,
                     project_id TEXT,
                     created_at INTEGER NOT NULL,
                     updated_at INTEGER NOT NULL
                 );
                 CREATE TABLE IF NOT EXISTS messages (
                     id TEXT PRIMARY KEY,
                     chat_id TEXT NOT NULL,
                     role TEXT NOT NULL,
                     content TEXT NOT NULL,
                     created_at INTEGER NOT NULL,
                     FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
                 );
                 CREATE TABLE IF NOT EXISTS artifacts (
                     id TEXT PRIMARY KEY,
                     name TEXT NOT NULL,
                     file_type TEXT NOT NULL,
                     content TEXT,
                     file_path TEXT,
                     chat_id TEXT,
                     message_id TEXT,
                     project_id TEXT,
                     created_at INTEGER NOT NULL,
                     updated_at INTEGER NOT NULL
                 );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_indexes",
            sql: "CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
                  CREATE INDEX IF NOT EXISTS idx_chats_project_id ON chats(project_id);
                  CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);
                  CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
                  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
                  CREATE INDEX IF NOT EXISTS idx_artifacts_chat_id ON artifacts(chat_id);
                  CREATE INDEX IF NOT EXISTS idx_artifacts_project_id ON artifacts(project_id);
                  CREATE INDEX IF NOT EXISTS idx_artifacts_updated_at ON artifacts(updated_at);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_full_remote_config",
            sql: "INSERT INTO configuration (key, value) VALUES ('full_remote', 'false');",
            kind: MigrationKind::Up,
        },
    ]
}
