/// Returns the OS login username.
/// Reads whoami::username() — already available via the whoami crate.
/// Falls back to empty string if unavailable.
#[tauri::command]
pub fn get_os_username() -> String {
    whoami::username()
}

/// Returns an absolute path to the OS user's avatar image, or null.
/// On macOS: scans ~/Library/Application Support/com.apple.AccountPicture.storage/
/// for a JPEG or PNG file. On all other platforms returns null.
#[tauri::command]
pub fn get_os_avatar_path() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        find_macos_avatar()
    }
    #[cfg(not(target_os = "macos"))]
    {
        None
    }
}

#[cfg(target_os = "macos")]
fn find_macos_avatar() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let storage_dir = std::path::Path::new(&home)
        .join("Library/Application Support/com.apple.AccountPicture.storage");

    if !storage_dir.exists() {
        return None;
    }

    let username = whoami::username();
    let entries = std::fs::read_dir(&storage_dir).ok()?;

    for entry in entries.flatten() {
        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !matches!(ext.as_str(), "jpg" | "jpeg" | "png") {
            continue;
        }
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        if stem.contains(&username.to_lowercase()) || stem.contains("picture") {
            if let Some(s) = path.to_str() {
                return Some(s.to_string());
            }
        }
    }

    None
}
