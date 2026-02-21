# Python Sidecar

FastAPI sidecar for AI Cowork Lab, bundled as a binary and spawned by Tauri at runtime.

## Architecture

```
[JS: initSidecar()]
    ↓ invoke('init')
[Rust: init command]
    ├─ dev mode: return http://127.0.0.1:1720 (assumes Python running)
    └─ release: find_port() → spawn binary with --port {PORT}
    ↓
[Python: uvicorn on 127.0.0.1:{PORT}]
```

## Files

| File               | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `main.py`          | FastAPI app with `/health` endpoint, `--port` defaults to 1720 |
| `pyinstaller.py`   | Builds binary with target-triple naming for Tauri              |
| `requirements.txt` | Python dependencies                                            |

## Development

In dev mode (`bun tauri dev`), the Python server runs on port 1720 via beforeDevCommand:

```bash
# Automatically started by tauri dev (chained with frontend)
bun tauri dev

# Or run manually in separate terminal
python main.py --port 1720
```

The Rust `init` command returns `http://127.0.0.1:1720` without spawning a binary.

## Build

```bash
# Create virtual environment and install dependencies
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Build binary (outputs to src-tauri/binaries/api-{target-triple})
python pyinstaller.py
```

## API

| Endpoint  | Method | Description                              |
| --------- | ------ | ---------------------------------------- |
| `/health` | GET    | Health check, returns `{"status": "ok"}` |

## Integration

Frontend usage via `src/lib/sidecar.ts`:

```typescript
import { initSidecar, fetchFromSidecar, checkHealth } from '@/lib/sidecar'

const { available, url, error } = await initSidecar()
const data = await fetchFromSidecar('/health')
const healthy = await checkHealth()
```

## Configuration

Set `full_remote: "true"` in the app's configuration table to disable local sidecar (use remote API instead).
