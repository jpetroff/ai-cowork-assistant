import asyncio
from curses import raw
import json
import os
import tempfile
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from lib.utils import log

from .types import ScrapedDocument, SearchResult


def _read_url(url: str, timeout: float, headers: dict[str, str] | None = None) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": "AI-Cowork-Lab/0.1",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            **(headers or {}),
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace")
    except (HTTPError, URLError) as error:
        raise RuntimeError(f"Failed to fetch {url}: {error}") from error


def _read_json(url: str, timeout: float) -> dict[str, Any]:
    return json.loads(_read_url(url, timeout))


def _trim_text(value: Any) -> str:
    return str(value or "").strip()


def _limit_markdown(markdown: str, max_chars: int) -> str:
    markdown = markdown.strip()
    if max_chars <= 0 or len(markdown) <= max_chars:
        return markdown
    return f"{markdown[:max_chars].rstrip()}\n\n[Content truncated.]"


class SearxngSearchProvider:
    async def search(
        self, query: str, config: dict[str, Any], max_results: int
    ) -> list[SearchResult]:
        base_url = _trim_text(config.get("base_url")) or "http://localhost:8080"
        timeout = float(config.get("timeout") or 10)
        categories = _trim_text(config.get("categories")) or "general"
        language = _trim_text(config.get("language"))
        params = {
            "q": query,
            "format": "json",
            "categories": categories,
        }
        if language:
            params["language"] = language
        endpoint = f"{base_url.rstrip('/')}/search?{urlencode(params)}"
        payload = await asyncio.to_thread(_read_json, endpoint, timeout)
        raw_results = payload.get("results", [])

        results: list[SearchResult] = []
        for item in raw_results:
            if not isinstance(item, dict):
                continue
            url = _trim_text(item.get("url"))
            if not url:
                continue
            results.append(
                SearchResult(
                    title=_trim_text(item.get("title")) or url,
                    url=url,
                    snippet=_trim_text(item.get("content")),
                    source="searxng",
                    metadata={
                        "engine": item.get("engine"),
                        "score": item.get("score"),
                    },
                )
            )
            if len(results) >= max_results:
                break
        return results


class DuckDuckGoSearchProvider:
    async def search(
        self, query: str, config: dict[str, Any], max_results: int
    ) -> list[SearchResult]:
        region = _trim_text(config.get("region")) or "wt-wt"

        def run_search() -> list[dict[str, Any]]:
            from llama_index.tools.duckduckgo import DuckDuckGoSearchToolSpec

            tool = DuckDuckGoSearchToolSpec()
            result =  tool.duckduckgo_full_search(
                query=query,
                region=region,
                max_results=max_results,
            )
            return result

        raw_results = await asyncio.to_thread(run_search)
        log(f"Raw search results: ${str(raw_results)}")
        results: list[SearchResult] = []
        for item in raw_results:
            url = _trim_text(item.get("href") or item.get("url"))
            if not url:
                continue
            results.append(
                SearchResult(
                    title=_trim_text(item.get("title")) or url,
                    url=url,
                    snippet=_trim_text(item.get("body") or item.get("snippet")),
                    source="duckduckgo",
                    metadata=dict(item),
                )
            )
        return results[:max_results]


class TrafilaturaScraper:
    async def scrape(
        self, result: SearchResult, config: dict[str, Any]
    ) -> ScrapedDocument:
        timeout = float(config.get("timeout") or 10)
        max_chars = int(config.get("max_chars") or 12000)

        def run_scrape() -> str:
            import trafilatura

            html = trafilatura.fetch_url(result.url)            
            if not html:
                raise RuntimeError(f"Trafilatura returned no HTML for {result.url}")
            markdown = trafilatura.extract(
                html,
                output_format="markdown",
                include_comments=False,
                include_tables=True,
            )
            if not markdown:
                raise RuntimeError(f"Trafilatura returned no markdown for {result.url}")
            return markdown

        markdown = await asyncio.to_thread(run_scrape)
        return ScrapedDocument(
            url=result.url,
            title=result.title,
            markdown=_limit_markdown(markdown, max_chars),
            source="trafilatura",
            metadata=result.metadata,
        )


class JinaScraper:
    async def scrape(
        self, result: SearchResult, config: dict[str, Any]
    ) -> ScrapedDocument:
        base_url = _trim_text(config.get("base_url")) or "https://r.jina.ai"
        timeout = float(config.get("timeout") or 20)
        max_chars = int(config.get("max_chars") or 12000)
        api_key = _trim_text(config.get("api_key"))
        headers = {"Accept": "text/plain"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        endpoint = f"{base_url.rstrip('/')}/{result.url}"
        markdown = await asyncio.to_thread(_read_url, endpoint, timeout, headers)
        if not markdown.strip():
            raise RuntimeError(f"Jina returned no markdown for {result.url}")
        return ScrapedDocument(
            url=result.url,
            title=result.title,
            markdown=_limit_markdown(markdown, max_chars),
            source="jina",
            metadata=result.metadata,
        )


class Crawl4AIScraper:
    async def scrape(
        self, result: SearchResult, config: dict[str, Any]
    ) -> ScrapedDocument:
        timeout = float(config.get("timeout") or 30)
        max_chars = int(config.get("max_chars") or 12000)

        async def run_scrape() -> str:
            os.environ.setdefault(
                "CRAWL4_AI_BASE_DIRECTORY",
                os.path.join(tempfile.gettempdir(), "ai-cowork-lab"),
            )
            from crawl4ai import AsyncWebCrawler

            async with AsyncWebCrawler() as crawler:
                crawl_result = await crawler.arun(url=result.url)
            if not getattr(crawl_result, "success", True):
                message = getattr(crawl_result, "error_message", "unknown error")
                raise RuntimeError(f"Crawl4AI failed for {result.url}: {message}")
            markdown = _trim_text(getattr(crawl_result, "markdown", ""))
            if not markdown:
                raise RuntimeError(f"Crawl4AI returned no markdown for {result.url}")
            return markdown

        markdown = await asyncio.wait_for(run_scrape(), timeout=timeout)
        return ScrapedDocument(
            url=result.url,
            title=result.title,
            markdown=_limit_markdown(markdown, max_chars),
            source="crawl4ai",
            metadata=result.metadata,
        )
