# Web Research

This documents the web search and scraping implementation used by the default chat/artifact workflow.

## What It Does

Web research is configured globally from Settings → Web Research and is sent with each chat completion request as `web_research`.

The default configuration is:

```json
{
  "enabled": true,
  "search_provider": "searxng",
  "scraper_provider": "trafilatura",
  "max_results": 5
}
```

The setting is stored in `app_settings` under `web_research_config`. No database migration is required because `app_settings` is already a key-value table.

## Request Flow

Frontend request assembly:

- `src/components/settings/webResearchConfig.ts` loads and saves the global setting.
- `src/components/chat/backgroundGenerationStore.ts` calls `loadWebResearchConfig()` while preparing the sidecar request.
- `src/lib/api-types.ts` is generated from `src-python/schemas.py` and includes `web_research`.

Python sidecar flow:

1. `src-python/routers/completion.py` validates the websocket payload as `ChatCompletionRequest`.
2. `src-python/llamaflows/run_workflow.py` passes `web_research` into `SimpleQueryWorkflow`.
3. `src-python/llamaflows/default/main.py` starts the workflow and runs `router`.
4. The router uses `WEB_ROUTER_PROMPT` and the selected LLM in non-streaming mode.
5. The LLM must return `TASK` or `QUERY`.
6. Invalid router output is normalized to `TASK`.
7. `TASK` skips web research and injects `No web context was fetched.`
8. `QUERY` runs a structured LLM query-planning step before calling the search provider.
9. Query planning uses `SEARCH_QUERY_PROMPT` and `SearchQueryPlan`, a Pydantic model shaped as `{"search_query":["query1"]}`.
10. Generated queries are stripped, blank values are removed, duplicates are removed case-insensitively, and the list is capped at 3.
11. If structured query planning fails or produces no usable queries, the workflow falls back to the original user request as a single search query.
12. The workflow calls `build_web_context()` for the generated queries in parallel and injects the joined markdown into `ARTIFACT_PROMPT`.

The workflow still streams artifact markdown and followup text the same way as before. Web routing/search progress is emitted as normal workflow event metadata.

## Query Planning Behavior

The search query planner is intentionally conservative. `SEARCH_QUERY_PROMPT` asks the LLM to extract key themes, entities, facts, or topics from the original user request and convert them into concise search queries.

The planner should:

- Use the fewest useful queries.
- Generate at most 3 queries.
- Avoid repeating the same topic across queries.
- Prefer short searchable phrases over the full user request.
- Preserve named entities, product names, dates, locations, and technical terms when they matter.

This prevents long or overly specific user prompts from being sent directly to the search provider while avoiding unnecessary parallel searches that would slow generation.

## Provider Model

Provider interfaces live in `src-python/llamaflows/web_research/types.py`:

- `SearchProvider.search(query, config, max_results) -> list[SearchResult]`
- `ScraperProvider.scrape(result, config) -> ScrapedDocument`

Provider registration lives in `src-python/llamaflows/web_research/service.py`:

- Search providers: `searxng`, `duckduckgo`
- Scraper providers: `trafilatura`, `jina`, `crawl4ai`

Only one search provider and one scraper provider run for a request. There is no fallback cascade yet. A `QUERY` route may still call the selected search provider multiple times in parallel when query planning returns more than one query.

## Provider Behavior

### SearXNG

`SearxngSearchProvider` calls:

```text
{base_url}/search?q={query}&format=json&categories={categories}
```

Default `base_url` is `http://localhost:8080`. The selected SearXNG instance must allow JSON output.

### DuckDuckGo

`DuckDuckGoSearchProvider` uses `llama-index-tools-duckduckgo` and calls `DuckDuckGoSearchToolSpec.duckduckgo_full_search()`.

### Trafilatura

`TrafilaturaScraper` fetches the URL and extracts markdown using `trafilatura.extract(..., output_format="markdown")`.

Trafilatura is the default scraper. It is fast for static/server-rendered pages, but it does not render JavaScript-heavy single page applications.

### Jina Reader

`JinaScraper` prefixes the source URL with the configured Reader endpoint.

Default endpoint:

```text
https://r.jina.ai
```

For `https://example.com`, the request URL becomes:

```text
https://r.jina.ai/https://example.com
```

### Crawl4AI

`Crawl4AIScraper` uses `AsyncWebCrawler` and reads `result.markdown`.

The adapter sets `CRAWL4_AI_BASE_DIRECTORY` to `/tmp/ai-cowork-lab` by default before importing Crawl4AI. This avoids Crawl4AI trying to create `~/.crawl4ai` in environments where home directory writes are restricted.

## Testing

Run Python provider and workflow tests:

```bash
cd src-python
env PYTHONPATH=. ./.venv/bin/pytest tests/test_web_research.py tests/test_llm_factory.py
```

Focused workflow/search-query planning tests:

```bash
cd src-python
./.venv/bin/python -m pytest tests/test_web_research.py
```

Run TypeScript type checks:

```bash
bunx tsc --noEmit
```

Run frontend tests:

```bash
bunx vitest run
```

Focused frontend tests for this feature:

```bash
bunx vitest run src/components/settings/__tests__/webResearchConfig.test.ts src/components/chat/__tests__/backgroundGenerationStore.test.ts
```

Regenerate API types after changing `src-python/schemas.py`:

```bash
cd src-python
./.venv/bin/python generate_types.py
```

## Manual Smoke Test

1. Open Settings → Web Research.
2. Keep `Automatic routing` enabled.
3. Set Search provider to `DuckDuckGo` for a no-SearXNG local smoke test.
4. Set Scraper provider to `Trafilatura`.
5. Save.
6. Ask a chat question that needs current or external information.
7. Confirm generation steps include `Routing request: QUERY` and `Fetching web context for 1 search query...` or `Fetching web context for N search queries...`.
8. Confirm the generated artifact reflects source content.

For a local SearXNG smoke test, run or configure a SearXNG endpoint that supports JSON output, then set the SearXNG endpoint field to that base URL.

## Known Notes

- Full `uv pip install -r requirements.txt` currently fails because `json2ts` is listed in `requirements.txt` but is not a Python registry package.
- The newly required runtime packages are `trafilatura` and `crawl4ai`.
- Crawl4AI installs browser automation packages and may need additional browser/runtime setup depending on the deployment environment.
- Structured query planning failures fall back to searching with the original user request.
- Search/scrape failures are caught in the workflow. If some parallel query searches succeed, artifact generation continues with the successful fetched sources. If all fail, artifact generation continues with a `Web research failed: ...` web context instead of aborting the request.
