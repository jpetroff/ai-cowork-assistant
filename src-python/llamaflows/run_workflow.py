from inspect import isgeneratorfunction
from typing import Sequence
from llama_index.llms.openai_like import OpenAILike
from llama_index.core.llms import LLM
from llama_index.llms.openai_like.base import CompletionResponseGen
from workflows.events import StopEvent

from llamaflows.default.main import SimpleQueryWorkflow, WorkflowResult
from schemas import ChatMessageBase, DefaultResponse
from config import settings


async def create_workflow(
    user_query: str,
    chat_history: Sequence[ChatMessageBase] | None = None,
):
    llm = OpenAILike(
        model="gpt-oss-20b",
        api_base=settings.api_base,
        is_chat_model=True
    )
    w = SimpleQueryWorkflow(
        llm=llm
    )
    handler = w.run(
        user_query=user_query,
        chat_history=[],
    )

     # now we handle events coming back from the workflow
    async for event in handler.stream_events():
        if isinstance(event, StopEvent) == False:
            yield DefaultResponse(type="event", payload=event.model_dump())

    final_result: WorkflowResult = await handler

    # accumulated_response = {
    #     "full_response": "",
    #     "full_followup": "",
    #     "generated_tokens": 0,
    # }

    if final_result.response_gen != None:
        async for response in final_result.response_gen:
            # accumulated_response["generated_tokens"] += 1
            # accumulated_response["full_response"] += str(response.delta)
            # _last_response = response
            yield DefaultResponse(
                type="completion.chunk", content=str(response.delta)
            )
    else:
        yield DefaultResponse(
            type="completion.response", content=str(final_result.response_text)
        )

    # yield DefaultResponse(
    #     type="completion.usage",
    #     payload={
    #         "generated_tokens": accumulated_response["generated_tokens"],
    #         # "traceId": trace.trace_id if trace is not None else None,
    #     },
    # )
