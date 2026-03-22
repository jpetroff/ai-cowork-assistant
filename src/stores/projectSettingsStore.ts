import { create } from 'zustand'
import { getSetting, setSetting } from '@/lib/db/settings'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectAiConfig {
  provider_id: string | null
  model: string | null
  embedding_model: string | null
}

const DEFAULT_AI_CONFIG: ProjectAiConfig = {
  provider_id: null,
  model: null,
  embedding_model: null,
}

function aiConfigKey(projectId: string): string {
  return `project:${projectId}:ai_config`
}

function parseAiConfig(raw: string | null): ProjectAiConfig {
  if (!raw) return { ...DEFAULT_AI_CONFIG }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_AI_CONFIG }
    const p = parsed as Record<string, unknown>
    return {
      provider_id: typeof p.provider_id === 'string' ? p.provider_id : null,
      model: typeof p.model === 'string' ? p.model : null,
      embedding_model: typeof p.embedding_model === 'string' ? p.embedding_model : null,
    }
  } catch {
    return { ...DEFAULT_AI_CONFIG }
  }
}

interface ProjectSettingsState {
  /** Maps project ID → cached AI config. */
  aiConfigs: Record<string, ProjectAiConfig>
}

interface ProjectSettingsActions {
  /**
   * Load the AI config for a project from app_settings.
   * Defaults to null fields if the key is missing or unparseable.
   */
  loadAiConfig: (projectId: string) => Promise<void>
  /**
   * Persist the AI config for a project to app_settings and update the store.
   */
  saveAiConfig: (projectId: string, config: ProjectAiConfig) => Promise<void>
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useProjectSettingsStore = create<ProjectSettingsState & ProjectSettingsActions>((set) => ({
  aiConfigs: {},

  async loadAiConfig(projectId) {
    try {
      const raw = await getSetting(aiConfigKey(projectId))
      set((s) => ({
        aiConfigs: { ...s.aiConfigs, [projectId]: parseAiConfig(raw) },
      }))
    } catch {
      set((s) => ({
        aiConfigs: { ...s.aiConfigs, [projectId]: { ...DEFAULT_AI_CONFIG } },
      }))
    }
  },

  async saveAiConfig(projectId, config) {
    set((s) => ({ aiConfigs: { ...s.aiConfigs, [projectId]: config } }))
    try {
      await setSetting(aiConfigKey(projectId), JSON.stringify(config))
    } catch {
      // Optimistic update stays in memory; DB write silently fails
    }
  },
}))
