import asyncio
import sys
import types

from llamaflows.default import main as default_main
from llamaflows.default.main import SimpleQueryWorkflow, _normalize_web_route
from llamaflows.web_research import providers, service
from llamaflows.web_research.providers import (
    Crawl4AIScraper,
    DuckDuckGoSearchProvider,
    JinaScraper,
    SearxngSearchProvider,
    TrafilaturaScraper,
)
from llamaflows.web_research.types import ScrapedDocument, SearchResult
from schemas import WebResearchConfig


def run(coro):
    return asyncio.run(coro)


class WorkflowResponse:
    def __init__(self, text="", delta="", additional_kwargs=None):
        self.text = text
        self.delta = delta
        self.additional_kwargs = additional_kwargs or {}


class FakeWorkflowLlm:
    def __init__(self, route="QUERY", queries=None, structured_error=None):
        self.route = route
        self.queries = queries or []
        self.structured_error = structured_error
        self.structured_calls = 0
        self.streamed_prompts = []

    async def acomplete(self, prompt):
        return WorkflowResponse(text=self.route)

    async def astructured_predict(self, output_cls, prompt, **prompt_args):
        self.structured_calls += 1
        assert output_cls is default_main.SearchQueryPlan
        assert prompt_args["user_query"]
        if self.structured_error:
            raise self.structured_error
        return output_cls(search_query=self.queries)

    async def astream_complete(self, prompt):
        self.streamed_prompts.append(prompt)

        async def generate():
            if "Artifact Markdown:" in prompt:
                yield WorkflowResponse(delta="# Artifact")
            else:
                yield WorkflowResponse(delta="Done")

        return generate()


async def run_workflow_with_llm(llm, user_query="research this"):
    workflow = SimpleQueryWorkflow(llm=llm, user_timeout=10)
    handler = workflow.run(
        user_query=user_query,
        chat_history=[],
        artifact=None,
        web_research=WebResearchConfig(),
    )
    async for _event in handler.stream_events():
        pass
    return await handler


def test_normalize_web_route_defaults_invalid_output_to_task():
    assert _normalize_web_route(" query\n") == "QUERY"
    assert _normalize_web_route("TASK") == "TASK"
    assert _normalize_web_route("something else") == "TASK"


def test_disabled_web_context_skips_providers(monkeypatch):
    class FailingSearchProvider:
        async def search(self, query, config, max_results):
            raise AssertionError("search should not run")

    monkeypatch.setitem(service.SEARCH_PROVIDERS, "searxng", FailingSearchProvider())

    context = run(build_context(WebResearchConfig(enabled=False)))

    assert context == "No web context was fetched."


def test_build_web_context_defaults_to_duckduckgo(monkeypatch):
    calls = {"duckduckgo": 0, "searxng": 0}

    class FakeDuckDuckGoProvider:
        async def search(self, query, config, max_results):
            calls["duckduckgo"] += 1
            assert config["region"] == "wt-wt"
            return []

    class FakeSearxngProvider:
        async def search(self, query, config, max_results):
            calls["searxng"] += 1
            return []

    monkeypatch.setitem(
        service.SEARCH_PROVIDERS, "duckduckgo", FakeDuckDuckGoProvider()
    )
    monkeypatch.setitem(service.SEARCH_PROVIDERS, "searxng", FakeSearxngProvider())

    context = run(
        build_context(
            WebResearchConfig(
                search={"duckduckgo": {"region": "wt-wt"}},
            )
        )
    )

    assert calls == {"duckduckgo": 1, "searxng": 0}
    assert context == "No web context was fetched."


def test_build_web_context_uses_searxng_when_config_is_provided(monkeypatch):
    calls = {"duckduckgo": 0, "searxng": 0}

    class FakeDuckDuckGoProvider:
        async def search(self, query, config, max_results):
            calls["duckduckgo"] += 1
            return []

    class FakeSearxngProvider:
        async def search(self, query, config, max_results):
            calls["searxng"] += 1
            assert config["base_url"] == "http://search.test"
            return []

    monkeypatch.setitem(
        service.SEARCH_PROVIDERS, "duckduckgo", FakeDuckDuckGoProvider()
    )
    monkeypatch.setitem(service.SEARCH_PROVIDERS, "searxng", FakeSearxngProvider())

    context = run(
        build_context(
            WebResearchConfig(
                search={"searxng": {"base_url": "http://search.test"}},
            )
        )
    )

    assert calls == {"duckduckgo": 0, "searxng": 1}
    assert context == "No web context was fetched."


def test_build_web_context_uses_selected_provider_pair(monkeypatch):
    calls = {"search": 0, "scrape": 0}

    class FakeSearchProvider:
        async def search(self, query, config, max_results):
            calls["search"] += 1
            assert config["base_url"] == "http://search.test"
            assert max_results == 2
            return [
                SearchResult(title="One", url="https://example.com/one"),
                SearchResult(title="Two", url="https://example.com/two"),
            ]

    class FakeScraperProvider:
        async def scrape(self, result, config):
            calls["scrape"] += 1
            assert config["timeout"] == 7
            return ScrapedDocument(
                title=result.title,
                url=result.url,
                markdown=f"# {result.title}",
                source="fake",
            )

    monkeypatch.setitem(service.SEARCH_PROVIDERS, "searxng", FakeSearchProvider())
    monkeypatch.setitem(service.SCRAPER_PROVIDERS, "trafilatura", FakeScraperProvider())

    config = WebResearchConfig(
        search_provider="searxng",
        max_results=2,
        search={"searxng": {"base_url": "http://search.test"}},
        scraping={"trafilatura": {"timeout": 7}},
    )
    context = run(build_context(config))

    assert calls == {"search": 1, "scrape": 2}
    assert "Source 1: One" in context
    assert "Source 2: Two" in context


def test_build_web_context_ignores_failed_scrapes(monkeypatch):
    class FakeSearchProvider:
        async def search(self, query, config, max_results):
            return [
                SearchResult(title="One", url="https://example.com/one"),
                SearchResult(title="Two", url="https://example.com/two"),
            ]

    class FakeScraperProvider:
        async def scrape(self, result, config):
            if result.url.endswith("/two"):
                raise RuntimeError("scrape failed")
            return ScrapedDocument(
                title=result.title,
                url=result.url,
                markdown=f"# {result.title}",
                source="fake",
            )

    monkeypatch.setitem(service.SEARCH_PROVIDERS, "duckduckgo", FakeSearchProvider())
    monkeypatch.setitem(service.SCRAPER_PROVIDERS, "trafilatura", FakeScraperProvider())

    context = run(build_context(WebResearchConfig(search_provider="duckduckgo")))

    assert "Source 1: One" in context
    assert "Source 2: Two" not in context


def test_task_route_workflow_runs_without_web_context(monkeypatch):
    async def fail_build_web_context(query, config):
        raise AssertionError("web context should not run")

    monkeypatch.setattr(default_main, "build_web_context", fail_build_web_context)

    llm = FakeWorkflowLlm(route="TASK")
    result = run(run_workflow_with_llm(llm, user_query="format this"))

    assert result.artifact_text == "# Artifact"
    assert result.message_text == "Done"
    assert llm.structured_calls == 0


def test_query_route_generates_parallel_search_queries(monkeypatch):
    calls = []

    async def fake_build_web_context(query, config):
        calls.append(query)
        await asyncio.sleep(0)
        return f"context for {query}"

    monkeypatch.setattr(default_main, "build_web_context", fake_build_web_context)

    llm = FakeWorkflowLlm(queries=["llamaindex structured output", "pydantic query"])
    result = run(run_workflow_with_llm(llm))

    assert calls == ["llamaindex structured output", "pydantic query"]
    assert llm.structured_calls == 1
    assert "context for llamaindex structured output" in llm.streamed_prompts[0]
    assert "context for pydantic query" in llm.streamed_prompts[0]
    assert result.artifact_text == "# Artifact"


def test_query_route_normalizes_dedupes_and_caps_queries(monkeypatch):
    calls = []

    async def fake_build_web_context(query, config):
        calls.append(query)
        return f"context for {query}"

    monkeypatch.setattr(default_main, "build_web_context", fake_build_web_context)

    llm = FakeWorkflowLlm(
        queries=[" Topic A ", "topic a", "", "Topic B", "Topic C", "Topic D"]
    )
    run(run_workflow_with_llm(llm))

    assert calls == ["Topic A", "Topic B", "Topic C"]


def test_query_route_falls_back_to_original_query_when_planning_fails(monkeypatch):
    calls = []

    async def fake_build_web_context(query, config):
        calls.append(query)
        return f"context for {query}"

    monkeypatch.setattr(default_main, "build_web_context", fake_build_web_context)

    llm = FakeWorkflowLlm(structured_error=RuntimeError("invalid structured output"))
    run(run_workflow_with_llm(llm, user_query="very specific original query"))

    assert calls == ["very specific original query"]


def test_searxng_provider_maps_results(monkeypatch):
    def fake_read_json(url, timeout):
        assert url.startswith("http://search.test/search?")
        assert timeout == 4
        return {
            "results": [
                {
                    "title": "Result",
                    "url": "https://example.com",
                    "content": "Snippet",
                    "engine": "test",
                    "score": 1,
                }
            ]
        }

    monkeypatch.setattr(providers, "_read_json", fake_read_json)

    results = run(
        SearxngSearchProvider().search(
            "query", {"base_url": "http://search.test", "timeout": 4}, 5
        )
    )

    assert results == [
        SearchResult(
            title="Result",
            url="https://example.com",
            snippet="Snippet",
            source="searxng",
            metadata={"engine": "test", "score": 1},
        )
    ]


def test_duckduckgo_provider_maps_results(monkeypatch):
    module = types.ModuleType("llama_index.tools.duckduckgo")

    class FakeDuckDuckGoSearchToolSpec:
        def duckduckgo_full_search(self, query, region, max_results):
            assert query == "query"
            assert region == "us-en"
            assert max_results == 1
            return [{"title": "Title", "href": "https://example.com", "body": "Body"}]

    module.DuckDuckGoSearchToolSpec = FakeDuckDuckGoSearchToolSpec
    monkeypatch.setitem(sys.modules, "llama_index.tools.duckduckgo", module)

    results = run(DuckDuckGoSearchProvider().search("query", {"region": "us-en"}, 1))

    assert results[0].title == "Title"
    assert results[0].url == "https://example.com"
    assert results[0].snippet == "Body"
    assert results[0].source == "duckduckgo"


def test_trafilatura_scraper_maps_markdown(monkeypatch):
    module = types.ModuleType("trafilatura")
    module.fetch_url = lambda url, timeout: "<html>content</html>"
    module.extract = lambda html, **kwargs: "# Markdown"
    monkeypatch.setitem(sys.modules, "trafilatura", module)

    document = run(
        TrafilaturaScraper().scrape(
            SearchResult(title="Title", url="https://example.com"), {}
        )
    )

    assert document.title == "Title"
    assert document.markdown == "# Markdown"
    assert document.source == "trafilatura"


def test_jina_scraper_maps_markdown(monkeypatch):
    captured = {}

    def fake_read_url(url, timeout, headers=None):
        captured["url"] = url
        captured["headers"] = headers
        return "# Markdown"

    monkeypatch.setattr(providers, "_read_url", fake_read_url)

    document = run(
        JinaScraper().scrape(
            SearchResult(title="Title", url="https://example.com"),
            {"api_key": "token"},
        )
    )

    assert captured["url"] == "https://r.jina.ai/https://example.com"
    assert captured["headers"]["Authorization"] == "Bearer token"
    assert document.markdown == "# Markdown"
    assert document.source == "jina"


def test_crawl4ai_scraper_maps_markdown(monkeypatch):
    module = types.ModuleType("crawl4ai")

    class Result:
        success = True
        markdown = "# Markdown"

    class FakeAsyncWebCrawler:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def arun(self, url):
            assert url == "https://example.com"
            return Result()

    module.AsyncWebCrawler = FakeAsyncWebCrawler
    monkeypatch.setitem(sys.modules, "crawl4ai", module)

    document = run(
        Crawl4AIScraper().scrape(
            SearchResult(title="Title", url="https://example.com"), {}
        )
    )

    assert document.markdown == "# Markdown"
    assert document.source == "crawl4ai"


async def build_context(config):
    return await service.build_web_context("query", config)
