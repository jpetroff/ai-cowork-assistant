from typing import Any, Literal, Optional, Union, Sequence
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum
import uuid


def _generate_artifact_id() -> str:
    return f"artifact-{uuid.uuid4().hex[:8]}"


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class DefaultResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    type: Union[
        Literal["error"],
        Literal["completion.response"],
        Literal["completion.chunk"],
        Literal["completion.chunk.thinking"],
        Literal["completion.usage"],
        Literal["completion.sources"],
        Literal["completion.hitl.request"],
        Literal["event"],
        Literal["confirmation"],
        str,
    ] = Field(description="Response type discriminator")
    payload: Optional[Any] = Field(
        default=None, description="Any JSON-serializable value"
    )
    content: Optional[Union[str, float, int]] = Field(
        default=None, description="Response content"
    )
    content_type: Optional[str] = Field(
        default=None,
        description="Optional MIME-style content marker for completion chunks",
    )


class TextHighlight(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    content: str = Field(description="The highlighted content")
    type: Literal["code", "markdown", "plain"] = Field(
        default="markdown", description="Content format type"
    )


class Artifact(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(
        default_factory=_generate_artifact_id, description="Unique artifact identifier"
    )
    content: str = Field(description="Artifact content")


class ChatCompletionArtifactContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    artifact_id: str = Field(description="Current artifact identifier")
    revision_id: Optional[str] = Field(
        default=None, description="Current artifact revision identifier"
    )
    content: str = Field(description="Current artifact revision content")


class KnowledgeGraphOrStorage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: Union[Literal["VectorStore"], Literal["DocumentStore"]] = Field(
        default="VectorStore", description="Storage type discriminator"
    )
    id: str = Field(description="Vector store or document store ID")
    client: Union[Literal["qdrant"], Literal["mongodb"], str] = Field(
        description="Storage client identifier"
    )


class ChatMessageBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    role: MessageRole = Field(description="Message role")
    content: str = Field(description="Message content")


class LlmProviderSettings(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    provider_id: str = Field(description="Configured provider identifier")
    provider_type: Literal["ollama", "openai_like", "openai", "anthropic"] = Field(
        description="LlamaIndex provider constructor discriminator"
    )
    name: str = Field(description="Provider display name")
    base_url: str = Field(description="Provider API base URL")
    api_key: Optional[str] = Field(default=None, description="Provider API key")
    model: str = Field(description="Model identifier")
    temperature: Optional[float] = Field(
        default=None, description="Sampling temperature"
    )
    max_tokens: Optional[int] = Field(default=None, description="Maximum output tokens")
    timeout: Optional[float] = Field(
        default=None, description="Request timeout in seconds"
    )
    context_window: Optional[int] = Field(default=None, description="Context window")
    is_chat_model: Optional[bool] = Field(
        default=None, description="Whether OpenAI-like provider uses chat endpoint"
    )
    is_function_calling_model: Optional[bool] = Field(
        default=None, description="Whether provider supports function calling"
    )
    thinking: Optional[Union[bool, Literal["low", "medium", "high"]]] = Field(
        default=None, description="Provider thinking mode"
    )
    reasoning_effort: Optional[str] = Field(
        default=None, description="OpenAI reasoning effort"
    )
    config: dict[str, Any] = Field(
        default_factory=dict, description="Provider-specific constructor options"
    )


class WebResearchConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    enabled: bool = Field(default=True, description="Enable automatic web research")
    search_provider: Literal["searxng", "duckduckgo"] = Field(
        default="duckduckgo", description="Selected web search provider"
    )
    scraper_provider: Literal["trafilatura", "jina", "crawl4ai"] = Field(
        default="trafilatura", description="Selected web scraping provider"
    )
    max_results: int = Field(
        default=5, ge=1, le=10, description="Maximum search results to scrape"
    )
    search: dict[str, dict[str, Any]] = Field(
        default_factory=dict,
        description="Search provider configuration keyed by provider name",
    )
    scraping: dict[str, dict[str, Any]] = Field(
        default_factory=dict,
        description="Scraper provider configuration keyed by provider name",
    )


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    message: str = Field(description="User message to process")
    chat_history: Sequence[ChatMessageBase] = Field(
        default_factory=list,
        validation_alias="chatHistory",
        description="Chat history for context",
    )
    artifact: Optional[ChatCompletionArtifactContext] = Field(
        default=None,
        description="Current artifact revision context",
    )
    llm_provider: LlmProviderSettings = Field(
        description="Resolved LLM provider settings for this request"
    )
    web_research: WebResearchConfig = Field(
        default_factory=WebResearchConfig,
        validation_alias="webResearch",
        description="Resolved web research settings for this request",
    )

    observability: Optional[bool] = Field(
        default=None, description="Enable Phoenix observability for this request"
    )
    file_uploads: Optional[list[str]] = Field(
        default=None,
        validation_alias="fileUploads",
        description="List of file paths to process",
    )
    working_folder: Optional[str] = Field(
        default=None,
        validation_alias="workingFolder",
        description="Working folder path",
    )
    knowledge_hubs: Optional[list[str]] = Field(
        default=None,
        validation_alias="knowledgeHubs",
        description="Subset of documents in vector database",
    )


class HealthResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: Literal["ok"] = Field(description="Health status")


class WorkflowInfo(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(description="Workflow name identifier")
    description: str = Field(default="", description="Workflow description")
    path: str = Field(description="Path to workflow file")


class EmbeddingProgress(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    filename: str = Field(description="File being processed")
    progress: int = Field(ge=0, le=100, description="Processing progress percentage")
    processed: int = Field(description="Number of files processed")
    total: int = Field(description="Total files to process")
    error: Optional[str] = Field(
        default=None, description="Error message if processing failed"
    )
