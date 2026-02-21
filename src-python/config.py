from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PYTHON_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    port: int = Field(default=9720, description="Port to run the FastAPI server on")
    observability_enabled: bool = Field(
        default=False, description="Enable Phoenix observability"
    )
    vector_db_path: str = Field(
        default="vector_storage.db", description="Path to ChromaDB persistent storage"
    )
    phoenix_endpoint: str = Field(
        default="http://127.0.0.1:6006/v1/traces",
        description="Phoenix OTLP endpoint for traces",
    )
    documents_path: str = Field(
        default="./documents", description="Path to document storage"
    )


settings = Settings()
