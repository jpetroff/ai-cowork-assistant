import argparse
import logging
import sys

import uvicorn
from fastapi import FastAPI

from config import settings
from observability import setup_observability
from routers import routers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

setup_observability()

app = FastAPI(
    title="AI Cowork Lab API",
    version="0.1.0",
    description="Python FastAPI sidecar for LLM workflows with LlamaIndex",
)

for router in routers:
    app.include_router(router)

logger.info(f"FastAPI app initialized with {len(routers)} routers")


def main():
    parser = argparse.ArgumentParser(description="AI Cowork Lab Sidecar")
    parser.add_argument("--port", type=int, default=settings.port)
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.setLevel(logging.DEBUG)

    log_level = "debug" if args.debug else "error"

    logger.info(f"Starting FastAPI server on 127.0.0.1:{args.port}")
    print(f"FastAPI running on 127.0.0.1:{args.port}...")

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=args.port,
        log_level=log_level,
        access_log=args.debug,
    )


if __name__ == "__main__":
    main()
