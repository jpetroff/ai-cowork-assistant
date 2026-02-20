use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Manager;

#[cfg(not(debug_assertions))]
use std::net::TcpListener;
#[cfg(not(debug_assertions))]
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct State {
    pub url: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
pub struct Info {
    pub available: bool,
    pub url: Option<String>,
    pub error: Option<String>,
}

#[cfg(not(debug_assertions))]
fn find_port() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    drop(listener);
    Ok(port)
}

#[tauri::command]
pub async fn init(app: tauri::AppHandle) -> Info {
    let state = app.state::<Mutex<State>>();

    if let Some(url) = state.lock().unwrap().url.clone() {
        return Info {
            available: true,
            url: Some(url),
            error: None,
        };
    }

    #[cfg(debug_assertions)]
    {
        let url = "http://127.0.0.1:1720".to_string();
        state.lock().unwrap().url = Some(url.clone());
        return Info {
            available: true,
            url: Some(url),
            error: None,
        };
    }

    #[cfg(not(debug_assertions))]
    {
        let port = match find_port() {
            Ok(p) => p,
            Err(e) => {
                state.lock().unwrap().error = Some(e.clone());
                return Info {
                    available: false,
                    url: None,
                    error: Some(e),
                };
            }
        };

        let spawn_result = app
            .shell()
            .sidecar("api")
            .map(|c| c.args([&port.to_string()]))
            .and_then(|c| c.spawn());

        if let Err(e) = spawn_result {
            let err = e.to_string();
            state.lock().unwrap().error = Some(err.clone());
            return Info {
                available: false,
                url: None,
                error: Some(err),
            };
        }

        let url = format!("http://127.0.0.1:{}", port);
        state.lock().unwrap().url = Some(url.clone());

        Info {
            available: true,
            url: Some(url),
            error: None,
        }
    }
}