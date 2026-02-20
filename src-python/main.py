import argparse
import uvicorn
from fastapi import FastAPI

app = FastAPI(title="AI Cowork Lab API", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok"}


def main():
    parser = argparse.ArgumentParser(description="AI Cowork Lab Sidecar")
    parser.add_argument("--port", type=int, default=1720)
    args = parser.parse_args()

    print(f"FastAPI running on 127.0.0.1:{args.port}...")

    uvicorn.run(
        app, host="127.0.0.1", port=args.port, log_level="error", access_log=False
    )


if __name__ == "__main__":
    main()
