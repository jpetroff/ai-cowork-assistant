use tauri::Manager;

/// Deletes the application data directory (SQLite DB + ChromaDB) and exits the process.
/// The destructive logic only runs in debug builds. In production, returns an error.
/// In `tauri dev`, the process watcher restarts the app automatically, giving a clean slate.
#[tauri::command]
pub fn clear_app_data(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        if app_data_dir.exists() {
            std::fs::remove_dir_all(&app_data_dir)
                .map_err(|e| format!("Failed to remove app data dir: {}", e))?;
        }
        std::process::exit(0);
    }

    #[cfg(not(debug_assertions))]
    {
        let _ = app;
        Err("clear_app_data is only available in development builds".to_string())
    }
}
