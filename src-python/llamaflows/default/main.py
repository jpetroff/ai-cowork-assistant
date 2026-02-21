from llama_index.core.llms import LLM
from llama_index.core.workflow import (
    step,
    Context,
    Workflow,
    Event,
    StartEvent,
    StopEvent,
)

from .prompts import SIMPLE_PROMPT


class ProgressEvent(Event):
    msg: str


class QueryStartEvent(Event):
    user_query: str
    chat_history: list


class QueryCompleteEvent(Event):
    response: str


class SimpleQueryWorkflow(Workflow):
    def __init__(
        self,
        llm: LLM,
        user_timeout: float | None = None,
    ) -> None:
        super().__init__()
        self._llm = llm
        self._user_timeout = user_timeout

    @step
    async def start_workflow(self, ctx: Context, ev: StartEvent) -> QueryStartEvent:
        user_query = ev.user_query
        chat_history = getattr(ev, "chat_history", [])

        ctx.write_event_to_stream(ProgressEvent(msg="Starting workflow execution"))

        return QueryStartEvent(user_query=user_query, chat_history=chat_history)

    @step
    async def process_query(
        self, ctx: Context, ev: QueryStartEvent
    ) -> QueryCompleteEvent:
        user_query = ev.user_query
        chat_history = ev.chat_history

        ctx.write_event_to_stream(ProgressEvent(msg="Processing your query..."))

        prompt = SIMPLE_PROMPT.format(user_query=user_query)

        ctx.write_event_to_stream(ProgressEvent(msg="Streaming LLM response..."))

        response_text = ""

        response_gen = await self._llm.astream_complete(
            prompt
        )
        async for chunk in response_gen:
            delta = chunk.delta or ""
            if delta:
                ctx.write_event_to_stream(ProgressEvent(msg=delta))
                response_text += delta

        ctx.write_event_to_stream(ProgressEvent(msg="Workflow completed successfully"))

        return QueryCompleteEvent(response=response_text)

    @step
    async def finalize(self, ctx: Context, ev: QueryCompleteEvent) -> StopEvent:
        ctx.write_event_to_stream(ProgressEvent(msg="Finalizing workflow"))

        return StopEvent(result=ev.response)
