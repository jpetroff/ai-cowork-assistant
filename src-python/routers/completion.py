import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from observability import setup_observability
from schemas import ChatCompletionRequest, DefaultResponse

router = APIRouter(tags=["completion"])
logger = logging.getLogger(__name__)


async def _process_completion(
    request: ChatCompletionRequest, websocket: WebSocket
) -> None:
    if request.observability is not None:
        setup_observability(enabled=request.observability)

    try:
        yield DefaultResponse(
            type="event",
            content="Processing request...",
        )

        # TODO: Integrate with LlamaIndex workflow
        # For now, echo back the message as chunks
        words = request.message.split()
        for i, word in enumerate(words):
            yield DefaultResponse(
                type="completion.chunk",
                content=word + " ",
                payload={"index": i},
            )

        yield DefaultResponse(
            type="completion.response",
            content=" ".join(words),
            payload={
                "chat_history_count": len(request.chat_history),
            },
        )

        yield DefaultResponse(
            type="completion.usage",
            payload={
                "input_tokens": len(request.message.split()),
                "output_tokens": len(words),
            },
        )

    except Exception as e:
        logger.error(f"Error processing completion: {e}")
        yield DefaultResponse(
            type="error",
            payload={"message": str(e), "code": "processing_error"},
        )


@router.websocket("/completion")
async def completion_websocket(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established")

    try:
        data: Any = await websocket.receive_json()
        request = ChatCompletionRequest.model_validate(data)
        logger.info(f"Received completion request: {request.message[:50]}...")

        async for response in _process_completion(request, websocket):
            await websocket.send_json(response.model_dump(exclude_none=True))

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            error_response = DefaultResponse(
                type="error",
                payload={"message": str(e), "code": "internal_error"},
            )
            await websocket.send_json(error_response.model_dump(exclude_none=True))
        except Exception:
            pass
