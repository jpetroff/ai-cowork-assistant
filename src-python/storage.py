import logging
from pathlib import Path
from typing import Optional

from llama_index.core import VectorStoreIndex, Document, StorageContext
from llama_index.embeddings.openai_like import OpenAILikeEmbedding
from llama_index.vector_stores.chroma import ChromaVectorStore

from config import settings

logger = logging.getLogger(__name__)


class VectorStorage:
    def __init__(self):
        self._client = None
        self._collection = None
        self._embed_model: Optional[OpenAILikeEmbedding] = None
        self._index: Optional[VectorStoreIndex] = None
        self._initialized = False

    def _ensure_storage_path(self):
        path = Path(settings.vector_db_path)
        path.parent.mkdir(parents=True, exist_ok=True)

    def initialize(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        embed_model: str = "text-embedding-3-small",
    ):
        self._ensure_storage_path()

        import chromadb

        self._client = chromadb.PersistentClient(path=settings.vector_db_path)
        self._collection = self._client.get_or_create_collection(name="default")

        self._embed_model = OpenAILikeEmbedding(
            api_key=api_key,
            api_base=base_url,
            model=embed_model,
        )

        vector_store = ChromaVectorStore(chroma_collection=self._collection)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)

        self._index = VectorStoreIndex(
            nodes=[],
            storage_context=storage_context,
            embed_model=self._embed_model,
        )
        self._initialized = True
        logger.info(f"Vector storage initialized at {settings.vector_db_path}")

    def is_initialized(self) -> bool:
        return self._initialized

    async def add_documents(self, documents: list[Document]) -> int:
        if not self._initialized or self._index is None:
            raise RuntimeError(
                "Vector storage not initialized. Call initialize() first."
            )

        for doc in documents:
            self._index.insert(doc)

        logger.info(f"Added {len(documents)} documents to vector storage")
        return len(documents)

    async def add_text(self, text: str, metadata: Optional[dict] = None) -> None:
        if not self._initialized or self._index is None:
            raise RuntimeError(
                "Vector storage not initialized. Call initialize() first."
            )

        doc = Document(text=text, metadata=metadata or {})
        self._index.insert(doc)
        logger.debug(f"Added text document with metadata: {metadata}")

    async def query(self, query_text: str, top_k: int = 5):
        if not self._initialized or self._index is None:
            raise RuntimeError(
                "Vector storage not initialized. Call initialize() first."
            )

        query_engine = self._index.as_query_engine(similarity_top_k=top_k)
        response = query_engine.query(query_text)
        return response

    def get_collection_count(self) -> int:
        if self._collection is None:
            return 0
        return self._collection.count()


storage = VectorStorage()
