from fsspec.utils import T
from llama_index.core.base.llms.types import CompletionResponseGen
from llama_index.core.llms import LLM
from llama_index.core.schema import NodeWithScore
from llama_index.core.workflow import (
    step,
    Context,
    Workflow,
    Event,
    StartEvent,
    StopEvent,
)

from typing import Any, List, Optional

from llama_index.llms.openai_like.base import CompletionResponse, CompletionResponseAsyncGen
from llama_index_instrumentation.span_handlers import null

from .prompts import SIMPLE_PROMPT


class ProgressEvent(Event):
    msg: str


class QueryStartEvent(Event):
    user_query: str
    chat_history: list
    artifact: Any = None


class QueryCompleteEvent(Event):
    response_text: Optional[CompletionResponse]
    response_gen: Optional[CompletionResponseAsyncGen]

class WorkflowResult:
    response_gen: CompletionResponseAsyncGen | None = None
    response_text: Optional[CompletionResponse]
    nodes: Optional[List[NodeWithScore]]
    result: CompletionResponseAsyncGen | CompletionResponse

    def __init__(
        self,
        response_gen: Optional[CompletionResponseAsyncGen],
        response_text: Optional[CompletionResponse],
        nodes: List[NodeWithScore] = [],
    ):
        self.response_gen = response_gen
        self.response_text = response_text
        self.nodes = nodes
        if response_gen:
            self.result = response_gen
        elif response_text:
            self.result = response_text
        else: 
            self.result = CompletionResponse(text='')


def _format_chat_history(chat_history: list) -> str:
    if not chat_history:
        return "No prior messages."

    return "\n".join(
        f"{getattr(message.role, 'value', message.role)}: {message.content}"
        for message in chat_history
    )


def _format_artifact_context(artifact: Any) -> str:
    if artifact is None:
        return "No current artifact."

    return (
        f"Artifact ID: {artifact.artifact_id}\n"
        f"Revision ID: {artifact.revision_id}\n"
        f"Content:\n{artifact.content}"
    )


class SimpleQueryWorkflow(Workflow):
    def __init__(
        self,
        llm: LLM,
        streaming: Optional[bool] = True,
        user_timeout: Optional[float] = None,
    ) -> None:
        super().__init__()
        self._llm = llm
        self._user_timeout = user_timeout
        self._response_streaming = streaming

    @step
    async def start_workflow(self, ctx: Context, ev: StartEvent) -> QueryStartEvent:
        user_query = ev.user_query
        chat_history = getattr(ev, "chat_history", [])
        artifact = getattr(ev, "artifact", None)

        ctx.write_event_to_stream(ProgressEvent(msg="Starting workflow execution"))

        return QueryStartEvent(
            user_query=user_query,
            chat_history=chat_history,
            artifact=artifact,
        )

    @step
    async def process_query(
        self, ctx: Context, ev: QueryStartEvent
    ) -> QueryCompleteEvent:
        user_query = ev.user_query
        chat_history = ev.chat_history
        artifact = ev.artifact

        prompt = SIMPLE_PROMPT.format(
            user_query=user_query,
            chat_history=_format_chat_history(chat_history),
            artifact_context=_format_artifact_context(artifact),
        )

        ctx.write_event_to_stream(ProgressEvent(msg="Processing your query…"))

        if (self._response_streaming):
            response_gen = await self._llm.astream_complete(
                prompt
            )
            return QueryCompleteEvent(response_gen=response_gen, response_text=None)
        else:
            response_text = self._llm.complete(
                prompt
            )
            return QueryCompleteEvent(response_gen=None, response_text=response_text)
    @step
    async def finalize(self, ctx: Context, ev: QueryCompleteEvent) -> StopEvent:
        ctx.write_event_to_stream(ProgressEvent(msg="Finalizing workflow"))

        return StopEvent(WorkflowResult(response_gen=ev.response_gen, response_text=ev.response_text))
