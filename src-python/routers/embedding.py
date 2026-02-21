import asyncio
import logging
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

from config import settings
from schemas import EmbeddingProgress

router = APIRouter(tags=["embedding"])
logger = logging.getLogger(__name__)


async def _process_file(file: UploadFile, index: int, total: int) -> EmbeddingProgress:
    try:
        content = await file.read()
        text_content = content.decode("utf-8", errors="replace")

        # TODO: Integrate with vector storage
        # from storage import storage
        # await storage.add_text(text_content, metadata={"filename": file.filename})

        logger.info(f"Processed file: {file.filename} ({len(text_content)} chars)")

        return EmbeddingProgress(
            filename=file.filename or "unknown",
            progress=int(((index + 1) / total) * 100),
            processed=index + 1,
            total=total,
        )
    except Exception as e:
        logger.error(f"Error processing file {file.filename}: {e}")
        return EmbeddingProgress(
            filename=file.filename or "unknown",
            progress=int(((index + 1) / total) * 100),
            processed=index + 1,
            total=total,
            error=str(e),
        )


async def _stream_embedding_progress(files: list[UploadFile]):
    total = len(files)

    yield (
        EmbeddingProgress(
            filename="",
            progress=0,
            processed=0,
            total=total,
        ).model_dump_json()
        + "\n"
    )

    for index, file in enumerate(files):
        progress = await _process_file(file, index, total)
        yield progress.model_dump_json() + "\n"
        await asyncio.sleep(0.01)

    yield (
        EmbeddingProgress(
            filename="",
            progress=100,
            processed=total,
            total=total,
        ).model_dump_json()
        + "\n"
    )


@router.post("/embedding")
async def upload_embedding(
    files: list[UploadFile] = File(
        ..., description="Files to embed into vector storage"
    ),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    logger.info(f"Received {len(files)} files for embedding")

    documents_path = Path(settings.documents_path)
    documents_path.mkdir(parents=True, exist_ok=True)

    return StreamingResponse(
        _stream_embedding_progress(files),
        media_type="application/x-ndjson",
    )
