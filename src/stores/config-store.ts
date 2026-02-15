import { create } from 'zustand'
import { loadConfiguration, CONFIG_KEYS, type Configuration } from '@/lib/db'

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
  isConfigured: boolean
  isHydrated: boolean
  setConfig: (state: Partial<ConfigState>) => void
  loadFromDb: () => Promise<void>
  setFromConfig: (config: Configuration) => void
}

export const useConfigStore = create<ConfigStore>((set) => ({
  ...defaultState,
  isConfigured: false,
  isHydrated: false,
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
      isHydrated: true,
    })
  },
  loadFromDb: async () => {
    try {
      const config = await loadConfiguration()
      const state = configToState(config)
      const isConfigured =
        config[CONFIG_KEYS.USER_NAME] != null ||
        config[CONFIG_KEYS.MODEL_NAME] != null
      set({
        ...state,
        isConfigured: isConfigured || Object.keys(config).length > 0,
        isHydrated: true,
      })
    } catch {
      set({
        ...defaultState,
        isConfigured: false,
        isHydrated: true,
      })
    }
  },
}))
