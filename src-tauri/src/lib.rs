mod db;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::Serialize;

#[derive(Serialize)]
pub struct SystemUserInfo {
    pub username: String,
    pub avatar_path: String,
}

// Returns current system user name and avatar path (desktop only).
// Avatar path may be empty if not available from system settings (e.g. macOS stores it in Directory Services).
#[tauri::command]
fn get_system_user_info() -> SystemUserInfo {
    let username = whoami::username();
    let avatar_path = String::new();
    SystemUserInfo {
        username,
        avatar_path,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(db::DB_NAME, db::migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init());

    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_mcp_bridge::init());

    builder
        .invoke_handler(tauri::generate_handler![get_system_user_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
