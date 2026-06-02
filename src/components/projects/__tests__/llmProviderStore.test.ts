import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { LlmProvider } from '@/lib/db/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockListLlmProviders = vi.fn<() => Promise<LlmProvider[]>>()
const mockCreateLlmProvider = vi.fn()
const mockUpdateLlmProvider = vi.fn()
const mockDeleteLlmProvider = vi.fn()
const mockSetDefaultProvider = vi.fn()

vi.mock('@/lib/db/repositories/llm-providers', () => ({
  listLlmProviders: () => mockListLlmProviders(),
  createLlmProvider: (...args: unknown[]) => mockCreateLlmProvider(...args),
  updateLlmProvider: (...args: unknown[]) => mockUpdateLlmProvider(...args),
  deleteLlmProvider: (...args: unknown[]) => mockDeleteLlmProvider(...args),
  setDefaultProvider: (...args: unknown[]) => mockSetDefaultProvider(...args),
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
    default_model: null,
    config_json: null,
    is_default: 0,
    created_at: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  useLlmProviderStore.setState({
    providers: [],
    modelsByProvider: {},
    status: 'idle',
  })
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

// ── CRUD actions ──────────────────────────────────────────────────────────────

describe('provider mutations', () => {
  it('creates a provider and reloads the list', async () => {
    mockCreateLlmProvider.mockResolvedValue('new-provider')
    mockListLlmProviders.mockResolvedValue([
      makeProvider({ id: 'new-provider', name: 'OpenAI' }),
    ])

    const id = await useLlmProviderStore.getState().createProvider({
      name: 'OpenAI',
      provider_type: 'openai',
      base_url: 'https://api.openai.com/v1',
      api_key: 'sk-test',
      default_model: 'gpt-test',
      config_json: '{"temperature":0.2}',
    })

    expect(id).toBe('new-provider')
    expect(mockCreateLlmProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        provider_type: 'openai',
        default_model: 'gpt-test',
      })
    )
    expect(useLlmProviderStore.getState().providers[0]?.id).toBe('new-provider')
  })

  it('updates a provider, clears model cache when connection fields change, and reloads', async () => {
    useLlmProviderStore.setState({
      providers: [makeProvider({ id: 'p1' })],
      modelsByProvider: { p1: ['cached'] },
      status: 'ready',
    })
    mockUpdateLlmProvider.mockResolvedValue(undefined)
    mockListLlmProviders.mockResolvedValue([
      makeProvider({ id: 'p1', base_url: 'http://localhost:11435' }),
    ])

    await useLlmProviderStore
      .getState()
      .updateProvider('p1', { base_url: 'http://localhost:11435' })

    expect(mockUpdateLlmProvider).toHaveBeenCalledWith('p1', {
      base_url: 'http://localhost:11435',
    })
    expect(useLlmProviderStore.getState().modelsByProvider.p1).toBeUndefined()
  })

  it('deletes a provider, removes cached models, and reloads', async () => {
    useLlmProviderStore.setState({
      providers: [makeProvider({ id: 'p1' })],
      modelsByProvider: { p1: ['cached'] },
      status: 'ready',
    })
    mockDeleteLlmProvider.mockResolvedValue(undefined)
    mockListLlmProviders.mockResolvedValue([])

    await useLlmProviderStore.getState().deleteProvider('p1')

    expect(mockDeleteLlmProvider).toHaveBeenCalledWith('p1')
    expect(useLlmProviderStore.getState().modelsByProvider.p1).toBeUndefined()
    expect(useLlmProviderStore.getState().providers).toEqual([])
  })

  it('marks a default provider and reloads', async () => {
    mockSetDefaultProvider.mockResolvedValue(undefined)
    mockListLlmProviders.mockResolvedValue([
      makeProvider({ id: 'p1', is_default: 1 }),
    ])

    await useLlmProviderStore.getState().setDefaultProvider('p1')

    expect(mockSetDefaultProvider).toHaveBeenCalledWith('p1')
    expect(useLlmProviderStore.getState().providers[0]?.is_default).toBe(1)
  })
})

// ── fetchModels() ─────────────────────────────────────────────────────────────

describe('fetchModels()', () => {
  it('fetches models and caches by provider id', async () => {
    const provider = makeProvider({
      id: 'p1',
      base_url: 'http://localhost:11434',
    })
    useLlmProviderStore.setState({ providers: [provider], status: 'ready' })

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [{ name: 'llama3' }, { model: 'mistral' }],
      }),
    })

    await useLlmProviderStore.getState().fetchModels('p1')

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.objectContaining({ method: 'GET' })
    )
    expect(useLlmProviderStore.getState().modelsByProvider['p1']).toEqual([
      'llama3',
      'mistral',
    ])
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

  it('refreshes models even if an empty result was cached', async () => {
    const provider = makeProvider({ id: 'p1' })
    useLlmProviderStore.setState({
      providers: [provider],
      modelsByProvider: { p1: [] },
      status: 'ready',
    })
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3' }] }),
    })

    await useLlmProviderStore.getState().fetchModels('p1', { refresh: true })

    expect(mockFetch).toHaveBeenCalled()
    expect(useLlmProviderStore.getState().modelsByProvider['p1']).toEqual([
      'llama3',
    ])
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

    await expect(
      useLlmProviderStore.getState().fetchModels('p1')
    ).resolves.not.toThrow()
    expect(useLlmProviderStore.getState().modelsByProvider['p1']).toEqual([])
  })

  it('appends Authorization header when api_key is set', async () => {
    const provider = makeProvider({
      id: 'p1',
      provider_type: 'openai',
      api_key: 'sk-secret',
      base_url: 'https://api.openai.com/v1',
    })
    useLlmProviderStore.setState({ providers: [provider], status: 'ready' })
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })

    await useLlmProviderStore.getState().fetchModels('p1')

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/models')
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
