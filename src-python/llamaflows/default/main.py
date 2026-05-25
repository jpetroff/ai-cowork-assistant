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

from llama_index.llms.openai_like.base import CompletionResponse

from . import prompts

ARTIFACT_CONTENT_TYPE = "text/markdown"


class ProgressEvent(Event):
    msg: str


class CompletionChunkEvent(Event):
    content: str
    content_type: Optional[str] = None


class CompletionThinkingEvent(Event):
    content: str


class QueryStartEvent(Event):
    user_query: str
    chat_history: list
    artifact: Any = None


class ArtifactGeneratedEvent(Event):
    user_query: str
    chat_history: list
    artifact: Any = None
    artifact_text: str


class QueryCompleteEvent(Event):
    artifact_text: str
    message_text: str


class WorkflowResult:
    artifact_text: str
    message_text: str
    nodes: Optional[List[NodeWithScore]]
    result: CompletionResponse

    def __init__(
        self,
        artifact_text: str,
        message_text: str,
        nodes: Optional[List[NodeWithScore]] = None,
    ):
        self.artifact_text = artifact_text
        self.message_text = message_text
        self.nodes = nodes or []
        self.result = CompletionResponse(text=message_text)


def _format_chat_history(chat_history: list) -> str:
    if not chat_history:
        return "No prior messages."

    return "\n".join(
        f"{getattr(message.role, 'value', message.role)}: {message.content}"
        for message in chat_history
    )


def _format_artifact_context(artifact: Any) -> str:
    if artifact is None:
        return "No artifact is attached to this request. Generate a new artifact."

    if artifact.revision_id is None and artifact.content == "":
        return (
            f"Artifact ID: {artifact.artifact_id}\n"
            "Revision ID: None\n"
            "Content:\n"
            "[Attached artifact is empty. Generate content for this artifact.]"
        )

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

    async def _complete_and_stream(
        self,
        ctx: Context,
        prompt: str,
        content_type: Optional[str] = None,
    ) -> str:
        full_response = ""

        if self._response_streaming:
            response_gen = await self._llm.astream_complete(prompt)
            async for response in response_gen:
                thinking_delta = response.additional_kwargs.get("thinking_delta")
                if thinking_delta is not None:
                    ctx.write_event_to_stream(
                        CompletionThinkingEvent(content=str(thinking_delta))
                    )
                    continue

                delta = str(response.delta or "")
                if not delta:
                    continue

                full_response += delta
                ctx.write_event_to_stream(
                    CompletionChunkEvent(content=delta, content_type=content_type)
                )
        else:
            response = self._llm.complete(prompt)
            full_response = str(response.text)
            if full_response:
                ctx.write_event_to_stream(
                    CompletionChunkEvent(
                        content=full_response, content_type=content_type
                    )
                )

        return full_response

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
    async def generate_artifact(
        self, ctx: Context, ev: QueryStartEvent
    ) -> ArtifactGeneratedEvent:
        user_query = ev.user_query
        chat_history = ev.chat_history
        artifact = ev.artifact

        prompt = prompts.ARTIFACT_PROMPT.format(
            user_query=user_query,
            chat_history=_format_chat_history(chat_history),
            artifact_context=_format_artifact_context(artifact),
        )

        ctx.write_event_to_stream(ProgressEvent(msg="Generating artifact…"))

        artifact_text = await self._complete_and_stream(
            ctx, prompt, content_type=ARTIFACT_CONTENT_TYPE
        )
        ctx.write_event_to_stream(
            CompletionChunkEvent(content="\n\n", content_type=ARTIFACT_CONTENT_TYPE)
        )

        return ArtifactGeneratedEvent(
            user_query=user_query,
            chat_history=chat_history,
            artifact=artifact,
            artifact_text=artifact_text,
        )

    @step
    async def generate_followup(
        self, ctx: Context, ev: ArtifactGeneratedEvent
    ) -> QueryCompleteEvent:
        prompt = prompts.FOLLOWUP_PROMPT.format(
            user_query=ev.user_query,
            chat_history=_format_chat_history(ev.chat_history),
            artifact_text=ev.artifact_text,
        )

        ctx.write_event_to_stream(ProgressEvent(msg="Generating followup…"))
        message_text = await self._complete_and_stream(ctx, prompt)

        return QueryCompleteEvent(
            artifact_text=ev.artifact_text,
            message_text=message_text,
        )

    @step
    async def finalize(self, ctx: Context, ev: QueryCompleteEvent) -> StopEvent:
        ctx.write_event_to_stream(ProgressEvent(msg="Finalizing workflow"))

        return StopEvent(
            WorkflowResult(
                artifact_text=ev.artifact_text.strip(),
                message_text=ev.message_text.strip(),
            )
        )
