// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::Serialize;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Serialize)]
pub struct SystemUserInfo {
    pub username: String,
    pub avatar_path: String,
}

/// Returns current system user name and avatar path (desktop only).
/// Avatar path may be empty if not available from system settings (e.g. macOS stores it in Directory Services).
#[tauri::command]
fn get_system_user_info() -> SystemUserInfo {
    let username = whoami::username();
    let avatar_path = String::new();
    SystemUserInfo {
        username,
        avatar_path,
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

const DB_NAME: &str = "sqlite:cowork.db";

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_configuration",
        sql: "CREATE TABLE IF NOT EXISTS configuration (key TEXT PRIMARY KEY, value TEXT);",
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(DB_NAME, migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_system_user_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
