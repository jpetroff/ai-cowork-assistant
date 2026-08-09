from llama_index.core.llms import LLM
from llama_index.core.prompts import PromptTemplate
from llama_index.core.schema import NodeWithScore
from llama_index.core.workflow import (
    step,
    Context,
    Workflow,
    Event,
    StartEvent,
    StopEvent,
)

import asyncio
from typing import Any, List, Optional, Union

from llama_index.llms.openai_like.base import CompletionResponse
from pydantic import BaseModel, Field

from schemas import WebResearchConfig
from llamaflows.web_research import build_web_context

from . import prompts

from lib.utils import log

ARTIFACT_CONTENT_TYPE = "text/markdown"
MAX_SEARCH_QUERIES = 3


class SearchQueryPlan(BaseModel):
    search_query: list[str] = Field(
        default_factory=list,
        description="Concise search queries extracted from the user request.",
    )


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
    web_research: WebResearchConfig


class TaskRouteEvent(Event):
    user_query: str
    chat_history: list
    artifact: Any = None
    web_research: WebResearchConfig
    route: str = "TASK"


class QueryRouteEvent(Event):
    user_query: str
    chat_history: list
    artifact: Any = None
    web_research: WebResearchConfig
    route: str = "QUERY"


class WebContextEvent(Event):
    user_query: str
    chat_history: list
    artifact: Any = None
    web_context: str


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


def _normalize_web_route(value: str) -> str:
    route = value.strip().upper()
    if route.startswith("QUERY"):
        return "QUERY"
    if route.startswith("TASK"):
        return "TASK"
    return "TASK"


def _normalize_search_queries(
    search_query_plan: SearchQueryPlan | None,
    fallback_query: str,
) -> list[str]:
    queries = search_query_plan.search_query if search_query_plan else []
    normalized_queries: list[str] = []
    seen: set[str] = set()

    for query in queries:
        normalized_query = str(query).strip()
        query_key = normalized_query.casefold()
        if not normalized_query or query_key in seen:
            continue

        normalized_queries.append(normalized_query)
        seen.add(query_key)
        if len(normalized_queries) == MAX_SEARCH_QUERIES:
            break

    return normalized_queries or [fallback_query]


class SimpleQueryWorkflow(Workflow):
    def __init__(
        self,
        llm: LLM,
        streaming: Optional[bool] = True,
        user_timeout: Optional[float] = None,
    ) -> None:
        super().__init__(timeout=user_timeout)
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

    async def _complete_once(self, prompt: str) -> str:
        if hasattr(self._llm, "acomplete"):
            response = await self._llm.acomplete(prompt)
        else:
            response = await asyncio.to_thread(self._llm.complete, prompt)
        return str(response.text)

    async def _generate_search_queries(self, user_query: str) -> list[str]:
        prompt = PromptTemplate(prompts.SEARCH_QUERY_PROMPT)

        try:
            if hasattr(self._llm, "astructured_predict"):
                search_query_plan = await self._llm.astructured_predict(
                    SearchQueryPlan,
                    prompt,
                    user_query=user_query,
                )
            else:
                search_query_plan = await asyncio.to_thread(
                    self._llm.structured_predict,
                    SearchQueryPlan,
                    prompt,
                    user_query=user_query,
                )
        except Exception:
            search_query_plan = None

        return _normalize_search_queries(search_query_plan, user_query)

    @step
    async def start_workflow(self, ctx: Context, ev: StartEvent) -> QueryStartEvent:
        user_query = ev.user_query
        chat_history = getattr(ev, "chat_history", [])
        artifact = getattr(ev, "artifact", None)
        web_research = getattr(ev, "web_research", WebResearchConfig())

        ctx.write_event_to_stream(ProgressEvent(msg="Starting workflow execution"))
        log(user_query)

        return QueryStartEvent(
            user_query=user_query,
            chat_history=chat_history,
            artifact=artifact,
            web_research=web_research,
        )

    @step
    async def router(
        self, ctx: Context, ev: QueryStartEvent
    ) -> Union[TaskRouteEvent, QueryRouteEvent]:
        if not ev.web_research.enabled:
            ctx.write_event_to_stream(ProgressEvent(msg="Routing request: TASK"))
            return TaskRouteEvent(
                user_query=ev.user_query,
                chat_history=ev.chat_history,
                artifact=ev.artifact,
                web_research=ev.web_research,
            )

        prompt = prompts.WEB_ROUTER_PROMPT.format(
            user_query=ev.user_query,
            chat_history=_format_chat_history(ev.chat_history),
            artifact_context=_format_artifact_context(ev.artifact),
        )
        route = _normalize_web_route(await self._complete_once(prompt))
        ctx.write_event_to_stream(ProgressEvent(msg=f"Routing request: {route}"))

        event_data = {
            "user_query": ev.user_query,
            "chat_history": ev.chat_history,
            "artifact": ev.artifact,
            "web_research": ev.web_research,
        }
        if route == "QUERY":
            log(route, next="QueryRouteEvent")
            return QueryRouteEvent(**event_data)
        
        log(route, next="TaskRouteEvent")
        return TaskRouteEvent(**event_data)

    @step
    async def prepare_task_context(
        self, ctx: Context, ev: TaskRouteEvent
    ) -> WebContextEvent:
        return WebContextEvent(
            user_query=ev.user_query,
            chat_history=ev.chat_history,
            artifact=ev.artifact,
            web_context="No web context was fetched.",
        )

    @step
    async def fetch_web_context(
        self, ctx: Context, ev: QueryRouteEvent
    ) -> WebContextEvent:
        search_queries = await self._generate_search_queries(ev.user_query)

        log("Generated search queries: " + str(search_queries))

        ctx.write_event_to_stream(
            ProgressEvent(
                msg=f"Fetching web context for {len(search_queries)} search query"
                f"{'' if len(search_queries) == 1 else 'ies'}…"
            )
        )

        search_results = await asyncio.gather(
            *[
                build_web_context(search_query, ev.web_research)
                for search_query in search_queries
            ],
            return_exceptions=True,
        )

        web_contexts = [
            str(search_result)
            for search_result in search_results
            if not isinstance(search_result, Exception)
        ]
        errors = [
            search_result
            for search_result in search_results
            if isinstance(search_result, Exception)
        ]

        if web_contexts:
            web_context = "\n\n".join(web_contexts)
            if errors:
                ctx.write_event_to_stream(
                    ProgressEvent(
                        msg="Some web research failed; continuing with fetched sources"
                    )
                )
        else:
            error = errors[0] if errors else "No web context was fetched."
            web_context = f"Web research failed: {error}"
            ctx.write_event_to_stream(
                ProgressEvent(msg="Web research failed; continuing without sources")
            )

        log("Retrieved search results: " + str(web_context), next="WebContextEvent")
        return WebContextEvent(
            user_query=ev.user_query,
            chat_history=ev.chat_history,
            artifact=ev.artifact,
            web_context=web_context,
        )

    @step
    async def generate_artifact(
        self, ctx: Context, ev: WebContextEvent
    ) -> ArtifactGeneratedEvent:
        user_query = ev.user_query
        chat_history = ev.chat_history
        artifact = ev.artifact

        prompt = prompts.ARTIFACT_PROMPT.format(
            user_query=user_query,
            chat_history=_format_chat_history(chat_history),
            artifact_context=_format_artifact_context(artifact),
            web_context=ev.web_context,
        )

        ctx.write_event_to_stream(ProgressEvent(msg="Generating artifact…"))

        artifact_text = await self._complete_and_stream(
            ctx, prompt, content_type=ARTIFACT_CONTENT_TYPE
        )
        ctx.write_event_to_stream(
            CompletionChunkEvent(content="\n\n", content_type=ARTIFACT_CONTENT_TYPE)
        )

        log("Generated artifact: " + str(artifact_text), next="ArtifactGeenratedEvent")
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

        log("Generated followup: " + str(message_text), next="QueryCompleteEvent")
        return QueryCompleteEvent(
            artifact_text=ev.artifact_text,
            message_text=message_text,
        )

    @step
    async def finalize(self, ctx: Context, ev: QueryCompleteEvent) -> StopEvent:
        ctx.write_event_to_stream(ProgressEvent(msg="Finalizing workflow"))

        log("Done. ", next="StopEvent")
        return StopEvent(
            WorkflowResult(
                artifact_text=ev.artifact_text.strip(),
                message_text=ev.message_text.strip(),
            )
        )
