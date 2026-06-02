import type { LlmProvider } from '@/lib/db/types'

export type ProviderType = 'ollama' | 'openai_like' | 'openai' | 'anthropic'

export interface ProviderConfig {
  temperature?: number
  max_tokens?: number
  timeout?: number
  request_timeout?: number
  max_retries?: number
  context_window?: number
  is_chat_model?: boolean
  is_function_calling_model?: boolean
  thinking?: boolean | 'low' | 'medium' | 'high'
  reasoning_effort?: string
  thinking_dict?: Record<string, unknown>
}

interface ProviderModelListRequest {
  url: string
  headers: Record<string, string>
}

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  ollama: 'Ollama',
  openai_like: 'Local OpenAI-like',
  openai: 'OpenAI',
  anthropic: 'Claude',
}

export const PROVIDER_DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  ollama: 'http://localhost:11434',
  openai_like: '',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
}

export const PROVIDER_DEFAULT_CONFIGS: Record<ProviderType, ProviderConfig> = {
  ollama: {
    context_window: -1,
    is_function_calling_model: true,
    request_timeout: 120,
  },
  openai_like: {
    context_window: 128000,
    is_chat_model: true,
    is_function_calling_model: false,
  },
  openai: {
    timeout: 60,
    max_retries: 3,
  },
  anthropic: {
    timeout: 60,
    max_retries: 3,
  },
}

export function isProviderType(value: string): value is ProviderType {
  return value in PROVIDER_LABELS
}

export function normalizeProviderType(value: string): ProviderType {
  if (value === 'custom') return 'openai_like'
  return isProviderType(value) ? value : 'openai_like'
}

export function parseProviderConfig(raw: string | null): ProviderConfig {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {}
    return parsed as ProviderConfig
  } catch {
    return {}
  }
}

export function stringifyProviderConfig(config: ProviderConfig): string | null {
  const entries = Object.entries(config).filter(([, value]) => {
    if (value === undefined || value === null || value === '') return false
    return true
  })
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : null
}

export function getProviderType(provider?: LlmProvider | null): ProviderType {
  return normalizeProviderType(provider?.provider_type ?? 'openai_like')
}

export function createProviderModelListRequest(
  providerType: ProviderType,
  baseUrl: string,
  apiKey?: string | null
): ProviderModelListRequest {
  const base = baseUrl.trim().replace(/\/$/, '')
  const headers: Record<string, string> = {}
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`

  return {
    url: `${base}${providerType === 'ollama' ? '/api/tags' : '/models'}`,
    headers,
  }
}

export function parseProviderModelList(
  providerType: ProviderType,
  json: unknown
): string[] {
  if (!json || typeof json !== 'object') return []

  if (providerType === 'ollama') {
    const models = (
      json as { models?: Array<{ name?: unknown; model?: unknown }> }
    ).models
    if (!Array.isArray(models)) return []
    return models
      .map((model) => model.name ?? model.model)
      .filter((model): model is string => typeof model === 'string')
  }

  const data = (json as { data?: Array<{ id?: unknown }> }).data
  if (!Array.isArray(data)) return []
  return data
    .map((model) => model.id)
    .filter((model): model is string => typeof model === 'string')
}
