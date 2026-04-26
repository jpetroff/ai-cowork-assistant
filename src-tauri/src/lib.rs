mod db;
mod sidecar;
mod system;

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
    let builder = if std::env::var("TAURI_MCP").map(|v| v == "1" || v == "true").unwrap_or(false) {
        builder.plugin(tauri_plugin_mcp_bridge::init())
    } else {
        builder
    };

    builder
        .invoke_handler(tauri::generate_handler![
            sidecar::init,
            system::get_os_username,
            system::get_os_avatar_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}