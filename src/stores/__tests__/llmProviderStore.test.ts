import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { LlmProvider } from '@/lib/db/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockListLlmProviders = vi.fn<() => Promise<LlmProvider[]>>()

vi.mock('@/lib/db/repositories/llm-providers', () => ({
  listLlmProviders: () => mockListLlmProviders(),
}))

const mockFetch = vi.fn()

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: (...args: unknown[]) => mockFetch(...args),
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useLlmProviderStore } from '../llmProviderStore'

function makeProvider(overrides: Partial<LlmProvider> = {}): LlmProvider {
  return {
    id: crypto.randomUUID(),
    name: 'Local Ollama',
    provider_type: 'ollama',
    base_url: 'http://localhost:11434',
    api_key: null,
    is_default: 0,
    created_at: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  useLlmProviderStore.setState({ providers: [], modelsByProvider: {}, status: 'idle' })
  vi.clearAllMocks()
})

// ── loadAll() ─────────────────────────────────────────────────────────────────

describe('loadAll()', () => {
  it('populates providers on success', async () => {
    const providers = [makeProvider({ name: 'A' }), makeProvider({ name: 'B' })]
    mockListLlmProviders.mockResolvedValue(providers)

    await useLlmProviderStore.getState().loadAll()

    expect(useLlmProviderStore.getState().providers).toEqual(providers)
    expect(useLlmProviderStore.getState().status).toBe('ready')
  })

  it('sets status to error on DB failure', async () => {
    mockListLlmProviders.mockRejectedValue(new Error('db error'))

    await useLlmProviderStore.getState().loadAll()

    expect(useLlmProviderStore.getState().status).toBe('error')
    expect(useLlmProviderStore.getState().providers).toHaveLength(0)
  })
})

// ── fetchModels() ─────────────────────────────────────────────────────────────

describe('fetchModels()', () => {
  it('fetches models and caches by provider id', async () => {
    const provider = makeProvider({ id: 'p1', base_url: 'http://localhost:11434' })
    useLlmProviderStore.setState({ providers: [provider], status: 'ready' })

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'llama3' }, { id: 'mistral' }] }),
    })

    await useLlmProviderStore.getState().fetchModels('p1')

    expect(useLlmProviderStore.getState().modelsByProvider['p1']).toEqual(['llama3', 'mistral'])
  })

  it('does not make a second network request if already cached', async () => {
    const provider = makeProvider({ id: 'p1' })
    useLlmProviderStore.setState({
      providers: [provider],
      modelsByProvider: { p1: ['cached-model'] },
      status: 'ready',
    })

    await useLlmProviderStore.getState().fetchModels('p1')

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('stores empty array on non-ok response', async () => {
    const provider = makeProvider({ id: 'p1' })
    useLlmProviderStore.setState({ providers: [provider], status: 'ready' })
    mockFetch.mockResolvedValue({ ok: false })

    await useLlmProviderStore.getState().fetchModels('p1')

    expect(useLlmProviderStore.getState().modelsByProvider['p1']).toEqual([])
  })

  it('stores empty array on network failure, does not throw', async () => {
    const provider = makeProvider({ id: 'p1' })
    useLlmProviderStore.setState({ providers: [provider], status: 'ready' })
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(useLlmProviderStore.getState().fetchModels('p1')).resolves.not.toThrow()
    expect(useLlmProviderStore.getState().modelsByProvider['p1']).toEqual([])
  })

  it('appends Authorization header when api_key is set', async () => {
    const provider = makeProvider({ id: 'p1', api_key: 'sk-secret', base_url: 'https://api.openai.com/v1' })
    useLlmProviderStore.setState({ providers: [provider], status: 'ready' })
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })

    await useLlmProviderStore.getState().fetchModels('p1')

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers?.Authorization).toBe('Bearer sk-secret')
  })

  it('does not add Authorization header for keyless providers', async () => {
    const provider = makeProvider({ id: 'p1', api_key: null })
    useLlmProviderStore.setState({ providers: [provider], status: 'ready' })
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })

    await useLlmProviderStore.getState().fetchModels('p1')

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers?.Authorization).toBeUndefined()
  })

  it('does nothing for an unknown provider id', async () => {
    useLlmProviderStore.setState({ providers: [], status: 'ready' })

    await useLlmProviderStore.getState().fetchModels('unknown')

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
