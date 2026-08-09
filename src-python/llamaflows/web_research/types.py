from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str = ""
    source: str = ""
    metadata: dict[str, Any] | None = None


@dataclass
class ScrapedDocument:
    url: str
    markdown: str
    title: str = ""
    source: str = ""
    metadata: dict[str, Any] | None = None


class SearchProvider(Protocol):
    async def search(
        self, query: str, config: dict[str, Any], max_results: int
    ) -> list[SearchResult]: ...


class ScraperProvider(Protocol):
    async def scrape(
        self, result: SearchResult, config: dict[str, Any]
    ) -> ScrapedDocument: ...
