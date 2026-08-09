import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from schemas import ChatCompletionRequest, DefaultResponse

from llamaflows.run_workflow import create_workflow

router = APIRouter(tags=["completion"])
logger = logging.getLogger(__name__)


@router.websocket("/completion")
async def completion_websocket(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection established")

    try:
        data: Any = await websocket.receive_json()
        request = ChatCompletionRequest.model_validate(data)
        logger.info(f"Received completion request: {request.message[:50]}...")

        handler = create_workflow(
            user_query=request.message,
            llm_provider=request.llm_provider,
            chat_history=request.chat_history,
            artifact=request.artifact,
            web_research=request.web_research,
        )

        async for response in handler:
            await websocket.send_json(response.model_dump(exclude_none=True))

        await websocket.close(code=1000, reason="workflow.complete")

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
            await websocket.close(code=1011, reason="workflow.error")
        except Exception:
            pass
