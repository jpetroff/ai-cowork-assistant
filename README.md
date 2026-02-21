# AI Cowork Lab

A Tauri desktop application with React frontend, Rust backend, and Python FastAPI sidecar.

## Project Structure

```
.
├── src/              # React frontend (Vite + TypeScript)
├── src-tauri/        # Rust backend (Tauri)
├── src-python/       # Python sidecar (FastAPI)
└── .vscode/          # VS Code configuration
```

## Prerequisites

- [Bun](https://bun.sh/) - Package manager
- [Rust](https://rustup.rs/) - For Tauri backend
- [Python 3.11+](https://python.org/) - For sidecar
- [VS Code](https://code.visualstudio.com/) or [Cursor](https://cursor.sh/)

## Recommended VS Code Extensions

- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
- [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)
- [Python](https://marketplace.visualstudio.com/items?itemName=ms-python.python)
- [Python Debugger](https://marketplace.visualstudio.com/items?itemName=ms-python.debugpy)

## Development

### Quick Start

```bash
# Terminal 1: Start Python sidecar
cd src-python && pip install -r requirements.txt && python main.py

# Terminal 2: Start Tauri dev
bun tauri dev
```

The Python sidecar runs on `http://127.0.0.1:9720`.

### Build

```bash
bun tauri build
```

## Debugging

### Rust Backend (Full Breakpoint Support)

1. Install [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) extension
2. Set breakpoints in `src-tauri/src/` files
3. Press `F5` → Select **"Tauri Development Debug"**

### Frontend (Platform-Specific)

**macOS (WebKit/Safari):**
1. Run `bun tauri dev`
2. Press `Cmd+Option+I` in app → Safari Web Inspector opens
3. Set JS breakpoints in Web Inspector

**Linux (WebKitGTK):**
1. Run `bun tauri dev`
2. Press `Ctrl+Shift+I` → WebKitGTK Inspector opens

**Windows (Edge WebView2):**
1. Run `bun tauri dev`
2. Press `Ctrl+Shift+I` → Edge DevTools opens

**Pre-Webview Debug (Chrome):**
- Press `F5` → Select **"Frontend Debug (Vite Dev Server)"**
- Works in Chrome before Tauri webview loads

### Python Sidecar

1. Open `src-python/main.py`
2. Set breakpoints
3. Press `F5` → Select **"Python: FastAPI Sidecar"**

### Debug Configurations

| Name | Platform | What It Debugs |
|------|----------|----------------|
| Tauri Development Debug | All | Rust backend |
| Tauri Production Debug | All | Rust backend (release) |
| Frontend Debug (Vite Dev Server) | Chrome | React/TypeScript |
| Python: FastAPI Sidecar | All | Python sidecar |

## Type Checking & Linting

```bash
# TypeScript
bunx tsc --noEmit

# Rust
cargo check --manifest-path src-tauri/Cargo.toml

# Python
pylint src-python/
black src-python/
```

## Full Build

```bash
bun tauri build
```