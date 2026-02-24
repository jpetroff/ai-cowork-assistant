from inspect import isgeneratorfunction
import json
from typing import Sequence, List
from llama_index.core.callbacks import CallbackManager, TokenCountingHandler
from llama_index.core.callbacks.base_handler import BaseCallbackHandler
from llama_index.llms.openai_like import OpenAILike
from llama_index.llms.ollama import Ollama
from llama_index.core.llms import LLM
from llama_index.llms.openai_like.base import CompletionResponseGen
from workflows.events import StopEvent

from llamaflows.default.main import SimpleQueryWorkflow, WorkflowResult
from schemas import ChatMessageBase, DefaultResponse
from config import settings
import tiktoken


async def create_workflow(
    user_query: str,
    chat_history: Sequence[ChatMessageBase] | None = None,
):
    # llm = OpenAILike(
    #     model="gpt-oss-20b",
    #     api_base=settings.api_base,
    #     is_chat_model=True
    # )

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
        chat_history=[],
    )

    # now we handle events coming back from the workflow
    async for event in handler.stream_events():
        if isinstance(event, StopEvent) == False:
            yield DefaultResponse(type="event", payload=event.model_dump())

    final_result: WorkflowResult = await handler

    if final_result.response_gen != None:
        async for response in final_result.response_gen:
            thinking_delta = response.additional_kwargs.get(
                "thinking_delta"
            )  # Thinking text
            if thinking_delta is not None:
                yield DefaultResponse(
                    type="completion.chunk.thinking", content=str(thinking_delta)
                )
            else:
                yield DefaultResponse(
                    type="completion.chunk", content=str(response.delta)
                )
        # Send completion signal after all chunks are streamed
        yield DefaultResponse(type="completion.response", content="")
    else:
        yield DefaultResponse(
            type="completion.response", content=str(final_result.response_text)
        )

    if token_counter is not None:
        # --- Retrieve Statistics ---
        print("Total Tokens:", token_counter.total_llm_token_count)
        print("Prompt Tokens:", token_counter.prompt_llm_token_count)
        print("Completion Tokens:", token_counter.completion_llm_token_count)

        # Reset counts for the next query if needed
        token_counter.reset_counts()
