// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let _ = fix_path_env::fix(); // https://github.com/tauri-apps/fix-path-env-rs
    ai_cowork_assistant_lib::run()
}