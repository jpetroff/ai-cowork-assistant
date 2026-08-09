import { useEffect, useState, type FormEvent } from 'react'
import { CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULT_WEB_RESEARCH_CONFIG,
  SCRAPER_PROVIDER_LABELS,
  SEARCH_PROVIDER_LABELS,
  loadWebResearchConfig,
  saveWebResearchConfig,
  type ScraperProvider,
  type SearchProvider,
  type WebResearchConfig,
} from './webResearchConfig'

function fieldValue(value: unknown): string {
  return value == null ? '' : String(value)
}

function clampMaxResults(value: string): number {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 1) return 1
  return Math.min(Math.trunc(number), 10)
}

function updateBlock(
  config: WebResearchConfig,
  group: 'search' | 'scraping',
  provider: string,
  key: string,
  value: string
): WebResearchConfig {
  return {
    ...config,
    [group]: {
      ...config[group],
      [provider]: {
        ...config[group][provider],
        [key]: value,
      },
    },
  }
}

export function WebResearchSettingsSection() {
  const [config, setConfig] = useState<WebResearchConfig>(
    DEFAULT_WEB_RESEARCH_CONFIG
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadWebResearchConfig()
      .then((loadedConfig) => {
        if (!cancelled) setConfig(loadedConfig)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function patchConfig(patch: Partial<WebResearchConfig>) {
    setConfig((current) => ({ ...current, ...patch }))
    setSaved(false)
  }

  function patchProviderBlock(
    group: 'search' | 'scraping',
    provider: string,
    key: string,
    value: string
  ) {
    setConfig((current) => updateBlock(current, group, provider, key, value))
    setSaved(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await saveWebResearchConfig(config)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const searchProvider = config.search_provider
  const scraperProvider = config.scraper_provider
  const searchConfig = config.search[searchProvider] ?? {}
  const scraperConfig = config.scraping[scraperProvider] ?? {}

  return (
    <Card className='max-w-3xl'>
      <CardHeader>
        <CardTitle>Web Research</CardTitle>
        <CardAction>
          {loading && <Spinner className='size-icon-sm' />}
        </CardAction>
      </CardHeader>
      <CardContent>
        <form className='flex flex-col gap-5' onSubmit={handleSubmit}>
          <div className='flex items-center justify-between gap-4 rounded-control border border-border px-control-x-md py-control-y-md'>
            <Label htmlFor='web-research-enabled'>Automatic routing</Label>
            <Switch
              id='web-research-enabled'
              checked={config.enabled}
              onCheckedChange={(checked) =>
                patchConfig({ enabled: Boolean(checked) })
              }
            />
          </div>

          <section className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <div className='space-y-2'>
              <Label>Search provider</Label>
              <Select
                value={config.search_provider}
                onValueChange={(value) =>
                  patchConfig({ search_provider: value as SearchProvider })
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(SEARCH_PROVIDER_LABELS) as SearchProvider[]
                  ).map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {SEARCH_PROVIDER_LABELS[provider]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label>Scraper provider</Label>
              <Select
                value={config.scraper_provider}
                onValueChange={(value) =>
                  patchConfig({ scraper_provider: value as ScraperProvider })
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(SCRAPER_PROVIDER_LABELS) as ScraperProvider[]
                  ).map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {SCRAPER_PROVIDER_LABELS[provider]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='web-research-max-results'>Max results</Label>
              <Input
                id='web-research-max-results'
                inputMode='numeric'
                value={String(config.max_results)}
                onChange={(event) =>
                  patchConfig({
                    max_results: clampMaxResults(event.target.value),
                  })
                }
              />
            </div>
          </section>

          <section className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            {searchProvider === 'searxng' ? (
              <>
                <div className='space-y-2'>
                  <Label htmlFor='searxng-base-url'>SearXNG endpoint</Label>
                  <Input
                    id='searxng-base-url'
                    value={fieldValue(searchConfig.base_url)}
                    onChange={(event) =>
                      patchProviderBlock(
                        'search',
                        'searxng',
                        'base_url',
                        event.target.value
                      )
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='searxng-timeout'>Search timeout</Label>
                  <Input
                    id='searxng-timeout'
                    inputMode='numeric'
                    value={fieldValue(searchConfig.timeout)}
                    onChange={(event) =>
                      patchProviderBlock(
                        'search',
                        'searxng',
                        'timeout',
                        event.target.value
                      )
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <div className='space-y-2'>
                  <Label htmlFor='duckduckgo-region'>DuckDuckGo region</Label>
                  <Input
                    id='duckduckgo-region'
                    value={fieldValue(searchConfig.region)}
                    onChange={(event) =>
                      patchProviderBlock(
                        'search',
                        'duckduckgo',
                        'region',
                        event.target.value
                      )
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='duckduckgo-max-results'>Search results</Label>
                  <Input
                    id='duckduckgo-max-results'
                    inputMode='numeric'
                    value={fieldValue(searchConfig.max_results)}
                    onChange={(event) =>
                      patchProviderBlock(
                        'search',
                        'duckduckgo',
                        'max_results',
                        event.target.value
                      )
                    }
                  />
                </div>
              </>
            )}
          </section>

          <section className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            {scraperProvider === 'jina' && (
              <>
                <div className='space-y-2'>
                  <Label htmlFor='jina-base-url'>Jina endpoint</Label>
                  <Input
                    id='jina-base-url'
                    value={fieldValue(scraperConfig.base_url)}
                    onChange={(event) =>
                      patchProviderBlock(
                        'scraping',
                        'jina',
                        'base_url',
                        event.target.value
                      )
                    }
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='jina-api-key'>Jina API key</Label>
                  <Input
                    id='jina-api-key'
                    type='password'
                    value={fieldValue(scraperConfig.api_key)}
                    onChange={(event) =>
                      patchProviderBlock(
                        'scraping',
                        'jina',
                        'api_key',
                        event.target.value
                      )
                    }
                  />
                </div>
              </>
            )}

            <div className='space-y-2'>
              <Label htmlFor='scraper-timeout'>Scraper timeout</Label>
              <Input
                id='scraper-timeout'
                inputMode='numeric'
                value={fieldValue(scraperConfig.timeout)}
                onChange={(event) =>
                  patchProviderBlock(
                    'scraping',
                    scraperProvider,
                    'timeout',
                    event.target.value
                  )
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='scraper-max-chars'>Source character cap</Label>
              <Input
                id='scraper-max-chars'
                inputMode='numeric'
                value={fieldValue(scraperConfig.max_chars)}
                onChange={(event) =>
                  patchProviderBlock(
                    'scraping',
                    scraperProvider,
                    'max_chars',
                    event.target.value
                  )
                }
              />
            </div>
          </section>

          <div className='flex items-center gap-3'>
            <Button type='submit' disabled={saving || loading}>
              {saving ? <Spinner className='size-icon-sm' /> : <CheckIcon />}
              Save web research
            </Button>
            {saved && (
              <p className='type-ui-sm text-muted-foreground' role='status'>
                Saved.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
