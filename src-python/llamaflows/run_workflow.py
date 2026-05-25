from typing import Sequence, List
from llama_index.core.callbacks import CallbackManager, TokenCountingHandler
from llama_index.core.callbacks.base_handler import BaseCallbackHandler
from llama_index.llms.ollama import Ollama
from workflows.events import StopEvent

from llamaflows.default.main import (
    CompletionChunkEvent,
    CompletionThinkingEvent,
    SimpleQueryWorkflow,
    WorkflowResult,
)
from schemas import ChatCompletionArtifactContext, ChatMessageBase, DefaultResponse
import tiktoken


async def create_workflow(
    user_query: str,
    chat_history: Sequence[ChatMessageBase] | None = None,
    artifact: ChatCompletionArtifactContext | None = None,
):
    # 1. Initialize token counter
    # Note: Since Ollama runs local models (e.g., Llama3), it's best to
    # use a tokenizer that matches, or simply the default for tracking.
    callbacks: List[BaseCallbackHandler] = []
    try:
        tiktoken.get_encoding("gpt-oss-20b")
        token_counter = TokenCountingHandler(
            tokenizer=tiktoken.encoding_for_model("gpt-oss-20b").encode
        )
        callbacks.append(token_counter)
    except:
        token_counter = None
        print("Could not initialize token encoding statistics…")
        pass

    llm = Ollama(
        model="gpt-oss:20b",
        base_url="http://ollama.intranet",
        thinking=True,
        callback_manager=CallbackManager(callbacks),
    )
    w = SimpleQueryWorkflow(llm=llm)
    handler = w.run(
        user_query=user_query,
        chat_history=list(chat_history or []),
        artifact=artifact,
    )

    # now we handle events coming back from the workflow
    async for event in handler.stream_events():
        if isinstance(event, CompletionThinkingEvent):
            yield DefaultResponse(
                type="completion.chunk.thinking", content=event.content
            )
        elif isinstance(event, CompletionChunkEvent):
            response = DefaultResponse(
                type="completion.chunk",
                content=event.content,
            )
            response.content_type = event.content_type
            yield response
        elif isinstance(event, StopEvent) == False:
            payload = event.model_dump()
            payload["event_name"] = event.__class__.__name__
            yield DefaultResponse(type="event", payload=payload)

    _final_result: WorkflowResult = await handler

    # Send completion signal after all chunks are streamed. The final result keeps
    # accumulated artifact/message text for observability and future metadata steps.
    yield DefaultResponse(type="completion.response", content="")

    if token_counter is not None:
        # --- Retrieve Statistics ---
        print("Total Tokens:", token_counter.total_llm_token_count)
        print("Prompt Tokens:", token_counter.prompt_llm_token_count)
        print("Completion Tokens:", token_counter.completion_llm_token_count)

        # Reset counts for the next query if needed
        token_counter.reset_counts()
