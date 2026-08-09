import { getSetting, setSetting, SETTING_KEYS } from '@/lib/db/settings'

export type SearchProvider = 'searxng' | 'duckduckgo'
export type ScraperProvider = 'trafilatura' | 'jina' | 'crawl4ai'

export interface WebResearchConfig {
  enabled: boolean
  search_provider: SearchProvider
  scraper_provider: ScraperProvider
  max_results: number
  search: Record<string, Record<string, unknown>>
  scraping: Record<string, Record<string, unknown>>
}

export const SEARCH_PROVIDER_LABELS: Record<SearchProvider, string> = {
  searxng: 'SearXNG',
  duckduckgo: 'DuckDuckGo',
}

export const SCRAPER_PROVIDER_LABELS: Record<ScraperProvider, string> = {
  trafilatura: 'Trafilatura',
  jina: 'Jina Reader',
  crawl4ai: 'Crawl4AI',
}

export const DEFAULT_WEB_RESEARCH_CONFIG: WebResearchConfig = {
  enabled: true,
  search_provider: 'duckduckgo',
  scraper_provider: 'trafilatura',
  max_results: 5,
  search: {
    searxng: {
      base_url: 'http://localhost:8080',
      timeout: 10,
      max_results: 5,
    },
    duckduckgo: {
      region: 'wt-wt',
      max_results: 5,
    },
  },
  scraping: {
    trafilatura: {
      timeout: 10,
      max_chars: 12000,
    },
    jina: {
      base_url: 'https://r.jina.ai',
      api_key: '',
      timeout: 20,
      max_chars: 12000,
    },
    crawl4ai: {
      timeout: 30,
      max_chars: 12000,
    },
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isSearchProvider(value: unknown): value is SearchProvider {
  return value === 'searxng' || value === 'duckduckgo'
}

function isScraperProvider(value: unknown): value is ScraperProvider {
  return value === 'trafilatura' || value === 'jina' || value === 'crawl4ai'
}

function numberOrDefault(
  value: unknown,
  fallback: number,
  max?: number
): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return max == null ? number : Math.min(number, max)
}

function mergeProviderBlocks(
  defaults: Record<string, Record<string, unknown>>,
  value: unknown
) {
  const blocks = isRecord(value) ? value : {}
  return Object.fromEntries(
    Object.entries(defaults).map(([provider, providerDefaults]) => {
      const candidate = blocks[provider]
      return [
        provider,
        {
          ...providerDefaults,
          ...(isRecord(candidate) ? candidate : {}),
        },
      ]
    })
  )
}

export function parseWebResearchConfig(raw: string | null): WebResearchConfig {
  if (!raw) return DEFAULT_WEB_RESEARCH_CONFIG
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return DEFAULT_WEB_RESEARCH_CONFIG
    return {
      enabled:
        typeof parsed.enabled === 'boolean'
          ? parsed.enabled
          : DEFAULT_WEB_RESEARCH_CONFIG.enabled,
      search_provider: isSearchProvider(parsed.search_provider)
        ? parsed.search_provider
        : DEFAULT_WEB_RESEARCH_CONFIG.search_provider,
      scraper_provider: isScraperProvider(parsed.scraper_provider)
        ? parsed.scraper_provider
        : DEFAULT_WEB_RESEARCH_CONFIG.scraper_provider,
      max_results: numberOrDefault(
        parsed.max_results,
        DEFAULT_WEB_RESEARCH_CONFIG.max_results,
        10
      ),
      search: mergeProviderBlocks(
        DEFAULT_WEB_RESEARCH_CONFIG.search,
        parsed.search
      ),
      scraping: mergeProviderBlocks(
        DEFAULT_WEB_RESEARCH_CONFIG.scraping,
        parsed.scraping
      ),
    }
  } catch {
    return DEFAULT_WEB_RESEARCH_CONFIG
  }
}

export function stringifyWebResearchConfig(config: WebResearchConfig): string {
  return JSON.stringify(config)
}

export async function loadWebResearchConfig(): Promise<WebResearchConfig> {
  return parseWebResearchConfig(
    await getSetting(SETTING_KEYS.WEB_RESEARCH_CONFIG)
  )
}

export async function saveWebResearchConfig(
  config: WebResearchConfig
): Promise<void> {
  await setSetting(
    SETTING_KEYS.WEB_RESEARCH_CONFIG,
    stringifyWebResearchConfig(config)
  )
}
