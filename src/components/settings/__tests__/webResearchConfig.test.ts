import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WEB_RESEARCH_CONFIG,
  parseWebResearchConfig,
  stringifyWebResearchConfig,
} from '../webResearchConfig'

describe('parseWebResearchConfig()', () => {
  it('returns defaults for missing or invalid JSON', () => {
    expect(parseWebResearchConfig(null)).toEqual(DEFAULT_WEB_RESEARCH_CONFIG)
    expect(parseWebResearchConfig('{')).toEqual(DEFAULT_WEB_RESEARCH_CONFIG)
    expect(parseWebResearchConfig(null).search_provider).toBe('duckduckgo')
  })

  it('merges provider blocks without dropping defaults', () => {
    const config = parseWebResearchConfig(
      JSON.stringify({
        enabled: false,
        search_provider: 'duckduckgo',
        scraper_provider: 'jina',
        max_results: 3,
        search: {
          duckduckgo: { region: 'us-en' },
        },
        scraping: {
          jina: { api_key: 'token' },
        },
      })
    )

    expect(config.enabled).toBe(false)
    expect(config.search_provider).toBe('duckduckgo')
    expect(config.scraper_provider).toBe('jina')
    expect(config.max_results).toBe(3)
    expect(config.search.duckduckgo.region).toBe('us-en')
    expect(config.search.searxng.base_url).toBe('http://localhost:8080')
    expect(config.scraping.jina.api_key).toBe('token')
    expect(config.scraping.jina.base_url).toBe('https://r.jina.ai')
  })
})

describe('stringifyWebResearchConfig()', () => {
  it('serializes config JSON', () => {
    expect(
      JSON.parse(stringifyWebResearchConfig(DEFAULT_WEB_RESEARCH_CONFIG))
    ).toEqual(DEFAULT_WEB_RESEARCH_CONFIG)
  })
})
