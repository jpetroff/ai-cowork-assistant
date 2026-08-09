import asyncio
from typing import Any

from lib.utils import log
from schemas import WebResearchConfig

from .providers import (
    Crawl4AIScraper,
    DuckDuckGoSearchProvider,
    JinaScraper,
    SearxngSearchProvider,
    TrafilaturaScraper,
)
from .types import ScrapedDocument, ScraperProvider, SearchProvider, SearchResult

SEARCH_PROVIDERS: dict[str, SearchProvider] = {
    "searxng": SearxngSearchProvider(),
    "duckduckgo": DuckDuckGoSearchProvider(),
}

SCRAPER_PROVIDERS: dict[str, ScraperProvider] = {
    "trafilatura": TrafilaturaScraper(),
    "jina": JinaScraper(),
    "crawl4ai": Crawl4AIScraper(),
}


def _provider_config(
    blocks: dict[str, dict[str, Any]],
    provider_name: str,
) -> dict[str, Any]:
    return dict(blocks.get(provider_name) or {})


def _resolve_search_provider_name(config: WebResearchConfig) -> str:
    searxng_config = _provider_config(config.search, "searxng")
    if config.search_provider == "searxng":
        return "searxng" if searxng_config else "duckduckgo"
    if "search_provider" not in config.model_fields_set and searxng_config:
        return "searxng"
    return "duckduckgo"


def _format_web_context(
    query: str,
    results: list[SearchResult],
    documents: list[ScrapedDocument],
) -> str:
    if not documents:
        return "No web context was fetched."

    sections = [
        "Fetched web context:",
        f"Search query: {query}",
        "",
    ]
    result_by_url = {result.url: result for result in results}
    for index, document in enumerate(documents, start=1):
        result = result_by_url.get(document.url)
        title = document.title or result.title if result else document.title
        snippet = result.snippet if result else ""
        sections.extend(
            [
                f"## Source {index}: {title or document.url}",
                f"URL: {document.url}",
                f"Search provider: {result.source if result else 'unknown'}",
                f"Scraper provider: {document.source}",
            ]
        )
        if snippet:
            sections.append(f"Search snippet: {snippet}")
        sections.extend(["", document.markdown.strip(), ""])

    return "\n".join(sections).strip()


async def build_web_context(query: str, config: WebResearchConfig) -> str:
    if not config.enabled:
        return "No web context was fetched."

    search_provider_name = _resolve_search_provider_name(config)
    search_provider = SEARCH_PROVIDERS[search_provider_name]
    scraper_provider = SCRAPER_PROVIDERS[config.scraper_provider]
    search_config = _provider_config(config.search, search_provider_name)
    scraper_config = _provider_config(config.scraping, config.scraper_provider)
    max_results = int(search_config.get("max_results") or config.max_results)

    log(f"Start search: {search_provider} {search_config} ", next="Scraper")

    results = await search_provider.search(query, search_config, max_results)

    log(f"Start scrape: {scraper_provider} {scraper_config} ", next="Finalization")
    scraped_results = await asyncio.gather(
        *[
            scraper_provider.scrape(result, scraper_config)
            for result in results[:max_results]
        ],
        return_exceptions=True,
    )
    log(f"Start scrape: ${scraper_provider} ${scraper_config} ", next="Finalization")
    documents = [
        document for document in scraped_results if not isinstance(document, BaseException)
    ]

    log(f"Web context finished with: {len(documents)} documents")
    return _format_web_context(query, results, list(documents))
