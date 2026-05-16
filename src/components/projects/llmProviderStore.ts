import { create } from 'zustand'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { listLlmProviders } from '@/lib/db/repositories/llm-providers'
import type { LlmProvider } from '@/lib/db/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

interface LlmProviderState {
  providers: LlmProvider[]
  /** Maps provider ID → list of model IDs fetched from the provider. */
  modelsByProvider: Record<string, string[]>
  status: StoreStatus
}

interface LlmProviderActions {
  /** Load all configured LLM providers from the DB. */
  loadAll: () => Promise<void>
  /**
   * Fetch available models from a provider's /models endpoint.
   * Result is cached in modelsByProvider for the session.
   * Non-fatal on network failure — stores empty array.
   */
  fetchModels: (providerId: string) => Promise<void>
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

  async fetchModels(providerId) {
    // Return cached result if already fetched
    if (get().modelsByProvider[providerId] != null) return

    const provider = get().providers.find((p) => p.id === providerId)
    if (!provider) return

    try {
      const url = provider.base_url.replace(/\/$/, '') + '/models'
      const res = await tauriFetch(url, {
        method: 'GET',
        headers: provider.api_key
          ? { Authorization: `Bearer ${provider.api_key}` }
          : {},
      })
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ id: string }> }
        const models = (json.data ?? []).map((m) => m.id)
        set((s) => ({
          modelsByProvider: { ...s.modelsByProvider, [providerId]: models },
        }))
      } else {
        set((s) => ({
          modelsByProvider: { ...s.modelsByProvider, [providerId]: [] },
        }))
      }
    } catch {
      set((s) => ({
        modelsByProvider: { ...s.modelsByProvider, [providerId]: [] },
      }))
    }
  },
}))
