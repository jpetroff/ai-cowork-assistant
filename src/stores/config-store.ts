import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import {
  loadConfiguration,
  saveConfiguration,
  CONFIG_KEYS,
  type Configuration,
} from '@/lib/db'
import { initSidecar, type SidecarInfo } from '@/lib/sidecar'

export type AppStatus = 'idle' | 'checking' | 'setup' | 'ready' | 'error'

export type ConfigState = {
  user_name: string
  user_avatar: string
  model_name: string
  model_api_url: string
}

const defaultState: ConfigState = {
  user_name: '',
  user_avatar: '',
  model_name: 'gpt-oss-20b',
  model_api_url: 'https://llama.intranet/v1',
}

function configToState(config: Configuration): ConfigState {
  return {
    user_name: config[CONFIG_KEYS.USER_NAME] ?? defaultState.user_name,
    user_avatar: config[CONFIG_KEYS.USER_AVATAR] ?? defaultState.user_avatar,
    model_name: config[CONFIG_KEYS.MODEL_NAME] ?? defaultState.model_name,
    model_api_url:
      config[CONFIG_KEYS.MODEL_API_URL] ?? defaultState.model_api_url,
  }
}

type ConfigStore = ConfigState & {
  status: AppStatus
  sidecarUrl: string | null
  isConfigured: boolean
  setConfig: (state: Partial<ConfigState>) => void
  setFromConfig: (config: Configuration) => void
  initialize: () => Promise<void>
  runSetup: () => Promise<void>
}

async function waitForSidecarHealth(url: string): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await tauriFetch(url + '/health', {
        method: 'GET',
        connectTimeout: 2000,
      })
      if (res.ok) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

export const useConfigStore = create<ConfigStore>((set) => ({
  ...defaultState,
  status: 'idle',
  sidecarUrl: null,
  isConfigured: false,
  setConfig: (state) => set(state),
  setFromConfig: (config) => {
    const state = configToState(config)
    const hasAny = Boolean(
      state.user_name ||
      state.user_avatar ||
      state.model_name ||
      state.model_api_url
    )
    set({
      ...state,
      isConfigured: hasAny,
    })
  },
  initialize: async () => {
    set({ status: 'checking' })

    const info: SidecarInfo = await initSidecar()

    if (!info.available || !info.url) {
      set({ status: 'error' })
      return
    }

    set({ sidecarUrl: info.url })

    const healthy = await waitForSidecarHealth(info.url)
    if (!healthy) {
      set({ status: 'error' })
      return
    }

    const config = await loadConfiguration()
    const state = configToState(config)
    const isConfigured = !!config[CONFIG_KEYS.USER_NAME]

    set({
      ...state,
      isConfigured,
      status: isConfigured ? 'ready' : 'setup',
    })
  },
  runSetup: async () => {
    set({ status: 'checking' })

    const info = await invoke<{ username: string; avatar_path: string }>(
      'get_system_user_info'
    )

    await saveConfiguration({
      [CONFIG_KEYS.USER_NAME]: info.username,
      [CONFIG_KEYS.USER_AVATAR]: info.avatar_path,
      [CONFIG_KEYS.MODEL_NAME]: 'gpt-oss-20b',
      [CONFIG_KEYS.MODEL_API_URL]: 'https://llama.intranet/v1',
    })

    const config = await loadConfiguration()
    const state = configToState(config)

    set({
      ...state,
      isConfigured: true,
      status: 'ready',
    })
  },
}))
