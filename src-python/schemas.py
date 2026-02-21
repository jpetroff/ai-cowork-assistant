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


class ChatCompletionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    message: str = Field(description="User message to process")
    chat_history: Sequence[ChatMessageBase] = Field(
        default_factory=list,
        validation_alias="chatHistory",
        description="Chat history for context",
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
