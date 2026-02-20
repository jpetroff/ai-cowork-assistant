use serde::Serialize;

mod db;
mod sidecar;

#[derive(Serialize)]
pub struct SystemUserInfo {
    pub username: String,
    pub avatar_path: String,
}

#[tauri::command]
fn get_system_user_info() -> SystemUserInfo {
    SystemUserInfo {
        username: whoami::username(),
        avatar_path: String::new(),
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
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(db::DB_NAME, db::migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .manage(std::sync::Mutex::new(sidecar::State::default()));

    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_mcp_bridge::init());

    builder
        .invoke_handler(tauri::generate_handler![
            get_system_user_info,
            sidecar::init
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}