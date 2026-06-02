import { create } from 'zustand'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import {
  createLlmProvider,
  deleteLlmProvider,
  listLlmProviders,
  setDefaultProvider as setDefaultLlmProvider,
  updateLlmProvider,
  type LlmProviderInput,
  type LlmProviderUpdate,
} from '@/lib/db/repositories/llm-providers'
import type { LlmProvider } from '@/lib/db/types'
import {
  createProviderModelListRequest,
  getProviderType,
  parseProviderModelList,
} from '@/components/settings/providerConfig'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

interface FetchModelsOptions {
  refresh?: boolean
}

interface LlmProviderState {
  providers: LlmProvider[]
  /** Maps provider ID → list of model IDs fetched from the provider. */
  modelsByProvider: Record<string, string[]>
  status: StoreStatus
}

interface LlmProviderActions {
  /** Load all configured LLM providers from the DB. */
  loadAll: () => Promise<void>
  /** Create a provider, reload the provider list, and return the new ID. */
  createProvider: (data: LlmProviderInput) => Promise<string>
  /** Update a provider and refresh cached provider rows. */
  updateProvider: (id: string, data: LlmProviderUpdate) => Promise<void>
  /** Delete a provider and remove its cached model list. */
  deleteProvider: (id: string) => Promise<void>
  /** Mark a provider as the default global provider. */
  setDefaultProvider: (id: string) => Promise<void>
  /**
   * Fetch available models from a provider's model-list endpoint.
   * Result is cached in modelsByProvider for the session.
   * Non-fatal on network failure — stores empty array.
   */
  fetchModels: (
    providerId: string,
    options?: FetchModelsOptions
  ) => Promise<string[]>
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useLlmProviderStore = create<
  LlmProviderState & LlmProviderActions
>((set, get) => ({
  providers: [],
  modelsByProvider: {},
  status: 'idle',

  async loadAll() {
    set({ status: 'loading' })
    try {
      const providers = await listLlmProviders()
      set({ providers, status: 'ready' })
    } catch {
      set({ status: 'error' })
    }
  },

  async createProvider(data) {
    const id = await createLlmProvider(data)
    await get().loadAll()
    return id
  },

  async updateProvider(id, data) {
    await updateLlmProvider(id, data)
    const shouldClearModels =
      data.base_url !== undefined || data.api_key !== undefined
    if (shouldClearModels) {
      set((s) => {
        const { [id]: _removed, ...modelsByProvider } = s.modelsByProvider
        return { modelsByProvider }
      })
    }
    await get().loadAll()
  },

  async deleteProvider(id) {
    await deleteLlmProvider(id)
    set((s) => {
      const { [id]: _removed, ...modelsByProvider } = s.modelsByProvider
      return { modelsByProvider }
    })
    await get().loadAll()
  },

  async setDefaultProvider(id) {
    await setDefaultLlmProvider(id)
    await get().loadAll()
  },

  async fetchModels(providerId, options) {
    // Return cached result if already fetched
    const cachedModels = get().modelsByProvider[providerId]
    if (cachedModels != null && !options?.refresh) return cachedModels

    const provider = get().providers.find((p) => p.id === providerId)
    if (!provider) return []

    try {
      const request = createProviderModelListRequest(
        getProviderType(provider),
        provider.base_url,
        provider.api_key
      )
      const res = await tauriFetch(request.url, {
        method: 'GET',
        headers: request.headers,
      })
      if (res.ok) {
        const models = parseProviderModelList(
          getProviderType(provider),
          await res.json()
        )
        set((s) => ({
          modelsByProvider: { ...s.modelsByProvider, [providerId]: models },
        }))
        return models
      } else {
        set((s) => ({
          modelsByProvider: { ...s.modelsByProvider, [providerId]: [] },
        }))
        return []
      }
    } catch {
      set((s) => ({
        modelsByProvider: { ...s.modelsByProvider, [providerId]: [] },
      }))
      return []
    }
  },
}))
