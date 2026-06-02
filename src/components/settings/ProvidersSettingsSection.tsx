import { useEffect, useMemo, useState } from 'react'
import {
  CheckIcon,
  PlugIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { useLlmProviderStore } from '@/components/projects/llmProviderStore'
import type { LlmProvider } from '@/lib/db/types'
import {
  PROVIDER_DEFAULT_BASE_URLS,
  PROVIDER_DEFAULT_CONFIGS,
  PROVIDER_LABELS,
  getProviderType,
  parseProviderConfig,
  stringifyProviderConfig,
  type ProviderConfig,
  type ProviderType,
} from './providerConfig'

interface ProviderDraft {
  name: string
  provider_type: ProviderType
  base_url: string
  api_key: string
  default_model: string
  temperature: string
  max_tokens: string
  timeout: string
  request_timeout: string
  max_retries: string
  context_window: string
  is_chat_model: boolean
  is_function_calling_model: boolean
  thinking: 'off' | 'on' | 'low' | 'medium' | 'high'
  reasoning_effort: string
  anthropic_thinking_budget: string
}

function configToDraft(providerType: ProviderType, config: ProviderConfig) {
  const defaults = PROVIDER_DEFAULT_CONFIGS[providerType]
  const merged = { ...defaults, ...config }
  const thinking: ProviderDraft['thinking'] =
    merged.thinking === true
      ? 'on'
      : merged.thinking === 'low' ||
          merged.thinking === 'medium' ||
          merged.thinking === 'high'
        ? merged.thinking
        : 'off'
  const budget =
    typeof merged.thinking_dict?.budget_tokens === 'number'
      ? String(merged.thinking_dict.budget_tokens)
      : ''

  return {
    temperature: merged.temperature == null ? '' : String(merged.temperature),
    max_tokens: merged.max_tokens == null ? '' : String(merged.max_tokens),
    timeout: merged.timeout == null ? '' : String(merged.timeout),
    request_timeout:
      merged.request_timeout == null ? '' : String(merged.request_timeout),
    max_retries: merged.max_retries == null ? '' : String(merged.max_retries),
    context_window:
      merged.context_window == null ? '' : String(merged.context_window),
    is_chat_model: Boolean(merged.is_chat_model),
    is_function_calling_model: Boolean(merged.is_function_calling_model),
    thinking,
    reasoning_effort: merged.reasoning_effort ?? '',
    anthropic_thinking_budget: budget,
  }
}

function makeDraft(provider?: LlmProvider | null): ProviderDraft {
  const providerType = getProviderType(provider)
  const config = parseProviderConfig(provider?.config_json ?? null)
  return {
    name: provider?.name ?? PROVIDER_LABELS[providerType],
    provider_type: providerType,
    base_url: provider?.base_url ?? PROVIDER_DEFAULT_BASE_URLS[providerType],
    api_key: provider?.api_key ?? '',
    default_model: provider?.default_model ?? '',
    ...configToDraft(providerType, config),
  }
}

function toOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function draftToConfig(draft: ProviderDraft): ProviderConfig {
  const config: ProviderConfig = {
    temperature: toOptionalNumber(draft.temperature),
    max_tokens: toOptionalNumber(draft.max_tokens),
    timeout: toOptionalNumber(draft.timeout),
    request_timeout: toOptionalNumber(draft.request_timeout),
    max_retries: toOptionalNumber(draft.max_retries),
    context_window: toOptionalNumber(draft.context_window),
    reasoning_effort: draft.reasoning_effort.trim() || undefined,
  }

  if (draft.provider_type === 'openai_like') {
    config.is_chat_model = draft.is_chat_model
    config.is_function_calling_model = draft.is_function_calling_model
  }

  if (draft.provider_type === 'ollama') {
    config.is_function_calling_model = draft.is_function_calling_model
    if (draft.thinking !== 'off') {
      config.thinking = draft.thinking === 'on' ? true : draft.thinking
    }
  }

  if (draft.provider_type === 'anthropic') {
    const budget = toOptionalNumber(draft.anthropic_thinking_budget)
    if (budget != null) {
      config.thinking_dict = { type: 'enabled', budget_tokens: budget }
    }
  }

  return config
}

export function ProvidersSettingsSection() {
  const providers = useLlmProviderStore((state) => state.providers)
  const modelsByProvider = useLlmProviderStore(
    (state) => state.modelsByProvider
  )
  const status = useLlmProviderStore((state) => state.status)
  const loadAll = useLlmProviderStore((state) => state.loadAll)
  const fetchModels = useLlmProviderStore((state) => state.fetchModels)
  const createProvider = useLlmProviderStore((state) => state.createProvider)
  const updateProvider = useLlmProviderStore((state) => state.updateProvider)
  const deleteProvider = useLlmProviderStore((state) => state.deleteProvider)
  const markDefault = useLlmProviderStore((state) => state.setDefaultProvider)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProviderDraft>(() => makeDraft())
  const [saving, setSaving] = useState(false)
  const [modelLoadingId, setModelLoadingId] = useState<string | null>(null)
  const [modelFetchMessage, setModelFetchMessage] = useState<string | null>(
    null
  )

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedId) ?? null,
    [providers, selectedId]
  )
  const models = selectedId ? (modelsByProvider[selectedId] ?? []) : []
  const isModelLoading = selectedId != null && modelLoadingId === selectedId
  const isNew = selectedId === null

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    setDraft(makeDraft(selectedProvider))
    setModelFetchMessage(null)
  }, [selectedProvider])

  function patchDraft(patch: Partial<ProviderDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function handleTypeChange(providerType: ProviderType) {
    const defaults = configToDraft(
      providerType,
      PROVIDER_DEFAULT_CONFIGS[providerType]
    )
    setDraft({
      ...makeDraft(),
      ...defaults,
      name: PROVIDER_LABELS[providerType],
      provider_type: providerType,
      base_url: PROVIDER_DEFAULT_BASE_URLS[providerType],
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.name.trim() || !draft.base_url.trim()) return

    setSaving(true)
    try {
      const payload = {
        name: draft.name.trim(),
        provider_type: draft.provider_type,
        base_url: draft.base_url.trim(),
        api_key: draft.api_key.trim() || null,
        default_model: draft.default_model.trim() || null,
        config_json: stringifyProviderConfig(draftToConfig(draft)),
      }

      if (isNew) {
        const id = await createProvider({
          ...payload,
          api_key: payload.api_key ?? undefined,
        })
        setSelectedId(id)
      } else if (selectedProvider) {
        await updateProvider(selectedProvider.id, payload)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleFetchModels() {
    if (!selectedId) return
    setModelLoadingId(selectedId)
    setModelFetchMessage(null)
    try {
      const fetchedModels = await fetchModels(selectedId, { refresh: true })
      setModelFetchMessage(
        fetchedModels.length > 0
          ? `${fetchedModels.length} model${fetchedModels.length === 1 ? '' : 's'} found.`
          : 'No models found. Check the connection and try again.'
      )
    } finally {
      setModelLoadingId(null)
    }
  }

  async function handleDelete(provider: LlmProvider) {
    const confirmed = window.confirm(`Delete ${provider.name}?`)
    if (!confirmed) return
    await deleteProvider(provider.id)
    setSelectedId(null)
  }

  return (
    <div className='grid min-h-0 grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)] gap-section-gap'>
      <Card size='sm' className='min-h-0'>
        <CardHeader>
          <CardTitle>Providers</CardTitle>
          <CardAction>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              aria-label='Add provider'
              onClick={() => setSelectedId(null)}
            >
              <PlusIcon className='size-icon-sm' />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className='flex flex-col gap-2'>
          {providers.length === 0 && (
            <p className='type-ui-sm text-muted-foreground'>
              No providers configured.
            </p>
          )}
          {providers.map((provider) => (
            <button
              key={provider.id}
              type='button'
              className='flex min-h-control-md w-full items-center justify-between gap-2 rounded-control px-control-x-sm py-control-y-sm text-left type-ui-sm transition-colors hover:bg-muted data-[active=true]:bg-muted'
              data-active={selectedId === provider.id}
              onClick={() => setSelectedId(provider.id)}
            >
              <span className='min-w-0'>
                <span className='block truncate font-medium'>
                  {provider.name}
                </span>
                <span className='block truncate text-muted-foreground'>
                  {PROVIDER_LABELS[getProviderType(provider)]}
                </span>
              </span>
              {provider.is_default === 1 && <Badge>Default</Badge>}
            </button>
          ))}
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='mt-2 w-full'
            onClick={() => setSelectedId(null)}
          >
            <PlusIcon className='size-icon-sm' />
            New provider
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isNew ? 'Add provider' : 'Provider settings'}</CardTitle>
          <CardAction>
            {status === 'loading' && <Spinner className='size-icon-sm' />}
          </CardAction>
        </CardHeader>
        <CardContent>
          <form className='flex flex-col gap-5' onSubmit={handleSubmit}>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='provider-name'>Name</Label>
                <Input
                  id='provider-name'
                  value={draft.name}
                  onChange={(event) => patchDraft({ name: event.target.value })}
                  placeholder='Local Ollama'
                />
              </div>

              <div className='space-y-2'>
                <Label>Provider type</Label>
                <Select
                  value={draft.provider_type}
                  onValueChange={(value) =>
                    handleTypeChange(value as ProviderType)
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROVIDER_LABELS) as ProviderType[]).map(
                      (type) => (
                        <SelectItem key={type} value={type}>
                          {PROVIDER_LABELS[type]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='provider-base-url'>Base URL</Label>
                <Input
                  id='provider-base-url'
                  value={draft.base_url}
                  onChange={(event) =>
                    patchDraft({ base_url: event.target.value })
                  }
                  placeholder='http://localhost:11434'
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='provider-api-key'>API key</Label>
                <Input
                  id='provider-api-key'
                  type='password'
                  value={draft.api_key}
                  onChange={(event) =>
                    patchDraft({ api_key: event.target.value })
                  }
                  placeholder='Optional for local providers'
                />
              </div>
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]'>
              <div className='space-y-2'>
                <Label htmlFor='provider-model'>Default model</Label>
                <Input
                  id='provider-model'
                  list='provider-models'
                  value={draft.default_model}
                  onChange={(event) =>
                    patchDraft({ default_model: event.target.value })
                  }
                  placeholder='Model ID'
                />
                <datalist id='provider-models'>
                  {models.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
                {modelFetchMessage && (
                  <p className='type-ui-xs text-muted-foreground' role='status'>
                    {modelFetchMessage}
                  </p>
                )}
              </div>

              <div className='flex items-end'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={handleFetchModels}
                  disabled={!selectedId || isModelLoading}
                >
                  {isModelLoading ? (
                    <Spinner className='size-icon-sm' />
                  ) : (
                    <RefreshCwIcon className='size-icon-sm' />
                  )}
                  Fetch models
                </Button>
              </div>
            </div>

            <section className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div className='space-y-2'>
                <Label htmlFor='provider-temperature'>Temperature</Label>
                <Input
                  id='provider-temperature'
                  inputMode='decimal'
                  value={draft.temperature}
                  onChange={(event) =>
                    patchDraft({ temperature: event.target.value })
                  }
                  placeholder='Optional'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='provider-max-tokens'>Max tokens</Label>
                <Input
                  id='provider-max-tokens'
                  inputMode='numeric'
                  value={draft.max_tokens}
                  onChange={(event) =>
                    patchDraft({ max_tokens: event.target.value })
                  }
                  placeholder='Optional'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='provider-timeout'>Timeout</Label>
                <Input
                  id='provider-timeout'
                  inputMode='numeric'
                  value={
                    draft.provider_type === 'ollama'
                      ? draft.request_timeout
                      : draft.timeout
                  }
                  onChange={(event) =>
                    draft.provider_type === 'ollama'
                      ? patchDraft({ request_timeout: event.target.value })
                      : patchDraft({ timeout: event.target.value })
                  }
                  placeholder='Seconds'
                />
              </div>
            </section>

            {(draft.provider_type === 'ollama' ||
              draft.provider_type === 'openai_like') && (
              <section className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                <div className='space-y-2'>
                  <Label htmlFor='provider-context-window'>
                    Context window
                  </Label>
                  <Input
                    id='provider-context-window'
                    inputMode='numeric'
                    value={draft.context_window}
                    onChange={(event) =>
                      patchDraft({ context_window: event.target.value })
                    }
                    placeholder='Optional'
                  />
                </div>
                <label className='flex items-center gap-2 self-end rounded-control border border-border px-control-x-md py-control-y-md type-ui-sm'>
                  <input
                    type='checkbox'
                    checked={draft.is_chat_model}
                    onChange={(event) =>
                      patchDraft({ is_chat_model: event.target.checked })
                    }
                    disabled={draft.provider_type !== 'openai_like'}
                  />
                  Chat model
                </label>
                <label className='flex items-center gap-2 self-end rounded-control border border-border px-control-x-md py-control-y-md type-ui-sm'>
                  <input
                    type='checkbox'
                    checked={draft.is_function_calling_model}
                    onChange={(event) =>
                      patchDraft({
                        is_function_calling_model: event.target.checked,
                      })
                    }
                  />
                  Function calling
                </label>
              </section>
            )}

            {(draft.provider_type === 'ollama' ||
              draft.provider_type === 'openai' ||
              draft.provider_type === 'anthropic') && (
              <section className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                {draft.provider_type === 'ollama' && (
                  <div className='space-y-2'>
                    <Label>Thinking</Label>
                    <Select
                      value={draft.thinking}
                      onValueChange={(value) =>
                        patchDraft({
                          thinking: value as ProviderDraft['thinking'],
                        })
                      }
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='off'>Off</SelectItem>
                        <SelectItem value='on'>On</SelectItem>
                        <SelectItem value='low'>Low</SelectItem>
                        <SelectItem value='medium'>Medium</SelectItem>
                        <SelectItem value='high'>High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {draft.provider_type === 'openai' && (
                  <div className='space-y-2'>
                    <Label htmlFor='provider-reasoning-effort'>
                      Reasoning effort
                    </Label>
                    <Input
                      id='provider-reasoning-effort'
                      value={draft.reasoning_effort}
                      onChange={(event) =>
                        patchDraft({ reasoning_effort: event.target.value })
                      }
                      placeholder='Optional'
                    />
                  </div>
                )}

                {draft.provider_type === 'anthropic' && (
                  <div className='space-y-2'>
                    <Label htmlFor='provider-thinking-budget'>
                      Thinking budget tokens
                    </Label>
                    <Input
                      id='provider-thinking-budget'
                      inputMode='numeric'
                      value={draft.anthropic_thinking_budget}
                      onChange={(event) =>
                        patchDraft({
                          anthropic_thinking_budget: event.target.value,
                        })
                      }
                      placeholder='Optional'
                    />
                  </div>
                )}

                <div className='space-y-2'>
                  <Label htmlFor='provider-max-retries'>Max retries</Label>
                  <Input
                    id='provider-max-retries'
                    inputMode='numeric'
                    value={draft.max_retries}
                    onChange={(event) =>
                      patchDraft({ max_retries: event.target.value })
                    }
                    placeholder='Optional'
                  />
                </div>
              </section>
            )}

            <div className='flex flex-wrap items-center gap-2'>
              <Button type='submit' disabled={saving}>
                {saving ? <Spinner className='size-icon-sm' /> : <CheckIcon />}
                {isNew ? 'Add provider' : 'Save provider'}
              </Button>
              {selectedProvider && (
                <>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => markDefault(selectedProvider.id)}
                    disabled={selectedProvider.is_default === 1}
                  >
                    <PlugIcon className='size-icon-sm' />
                    Set default
                  </Button>
                  <Button
                    type='button'
                    variant='destructive'
                    onClick={() => handleDelete(selectedProvider)}
                  >
                    <Trash2Icon className='size-icon-sm' />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
