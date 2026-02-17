use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_NAME: &str = "sqlite:user_data.db";

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_configuration",
            sql: "CREATE TABLE IF NOT EXISTS configuration (key TEXT PRIMARY KEY, value TEXT);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_chats",
            sql: "CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_messages",
            sql: "CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "create_artifacts",
            sql: "CREATE TABLE IF NOT EXISTS artifacts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                content TEXT,
                file_path TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_chat_and_message_to_artifacts",
            sql: "ALTER TABLE artifacts ADD COLUMN chat_id TEXT;
                 ALTER TABLE artifacts ADD COLUMN message_id TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add_indexes_for_performance",
            sql: "CREATE INDEX IF NOT EXISTS idx_artifacts_chat_id ON artifacts(chat_id);
                 CREATE INDEX IF NOT EXISTS idx_artifacts_updated_at ON artifacts(updated_at);
                 CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
                 CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
                 CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);",
            kind: MigrationKind::Up,
        },
    ]
}
