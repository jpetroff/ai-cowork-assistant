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

/**
 * Represents the current state of the application during initialization
 * and runtime.
 *
 * @remarks
 * - `'idle'`: Initial state before any initialization has started
 * - `'checking'`: Currently checking system status (sidecar health, etc.)
 * - `'setup'`: Configuration is incomplete, user needs to run setup
 * - `'ready'`: Application is fully configured and ready to use
 * - `'error'`: An error occurred during initialization
 */
export type AppStatus = 'idle' | 'checking' | 'setup' | 'ready' | 'error'

/**
 * Core configuration state for the application, containing user and model settings.
 *
 * @property user_name - The display name of the current user
 * @property user_avatar - Path to the user's avatar image
 * @property model_name - The name of the AI model being used
 * @property model_api_url - The base URL for the AI model's API endpoint
 */
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

/**
 * Converts a Configuration object to the ConfigState format.
 *
 * @param config - The Configuration object to convert, typically loaded from the database
 * @returns A ConfigState object with values from the configuration, falling back to defaults
 */
export function configToState(config: Configuration): ConfigState {
  return {
    user_name: config[CONFIG_KEYS.USER_NAME] ?? defaultState.user_name,
    user_avatar: config[CONFIG_KEYS.USER_AVATAR] ?? defaultState.user_avatar,
    model_name: config[CONFIG_KEYS.MODEL_NAME] ?? defaultState.model_name,
    model_api_url:
      config[CONFIG_KEYS.MODEL_API_URL] ?? defaultState.model_api_url,
  }
}

/**
 * Zustand store type combining ConfigState with application management functions.
 * Extends ConfigState with status tracking and initialization helpers.
 *
 * @extends ConfigState
 * @property status - Current application status (idle, checking, setup, ready, error)
 * @property sidecarUrl - The URL where the sidecar service is running, or null if not available
 * @property isConfigured - Whether the application has been configured with at least one user
 * @property setConfig - Update config state with partial state object
 * @property setFromConfig - Update state from a Configuration object and set isConfigured flag
 * @property initialize - Main initialization function that checks sidecar and loads configuration
 * @property runSetup - Runs the initial setup process to configure the application
 */
export type ConfigStore = ConfigState & {
  status: AppStatus
  sidecarUrl: string | null
  isConfigured: boolean
  setConfig: (state: Partial<ConfigState>) => void
  setFromConfig: (config: Configuration) => void
  initialize: () => Promise<void>
  runSetup: () => Promise<void>
}

/**
 * Polls the sidecar health endpoint until it becomes available or timeout is reached.
 *
 * @param url - The base URL of the sidecar service to check
 * @returns Promise that resolves to true if the sidecar is healthy within 15 seconds, false otherwise
 * @remarks
 * This function attempts to connect to the sidecar's /health endpoint up to 30 times
 * with a 500ms delay between attempts (total timeout: 15 seconds).
 */
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

/**
 * Zustand store for application configuration and initialization state.
 *
 * @remarks
 * This store manages:
 * - User configuration (name, avatar)
 * - AI model configuration (name, API URL)
 * - Application startup status (idle, checking, setup, ready, error)
 * - Sidecar service health and URL tracking
 * - Configuration persistence via database
 *
 * @example
 * ```ts
 * import { useConfigStore } from '@/stores/config-store'
 *
 * const { status, user_name, initialize, runSetup } = useConfigStore()
 *
 * if (status === 'ready') {
 *   // Application is configured and ready
 * }
 *
 * await initialize()
 * ```
 */
export const useConfigStore = create<ConfigStore>((set) => ({
  ...defaultState,
  status: 'idle',
  sidecarUrl: null,
  isConfigured: false,
  /**
   * Updates the config state with partial state object.
   *
   * @param state - Partial ConfigState object containing fields to update
   * @example
   * ```ts
   * setConfig({ user_name: 'John' })
   * ```
   */
  setConfig: (state) => set(state),
  /**
   * Updates state from a Configuration object and sets the isConfigured flag.
   *
   * @param config - Configuration object loaded from the database
   * @remarks
   * Converts the Configuration object to ConfigState using configToState.
   * Sets isConfigured to true if any configuration value is present.
   */
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
  /**
   * Main initialization function that performs application startup checks.
   *
   * @remarks
   * This async function executes the following sequence:
   * 1. Sets status to 'checking'
   * 2. Initializes the sidecar service via initSidecar()
   * 3. Verifies sidecar health via waitForSidecarHealth()
   * 4. Loads configuration from database
   * 5. Updates state with loaded config
   * 6. Sets status to 'ready' if configured, 'setup' otherwise
   *
   * @example
   * ```ts
   * await initialize()
   * const { status, sidecarUrl } = useConfigStore.getState()
   * ```
   */
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
  /**
   * Runs the initial setup process to configure the application.
   *
   * @remarks
   * This async function executes the following sequence:
   * 1. Sets status to 'checking'
   * 2. Retrieves system user info (username and avatar path) via Tauri IPC
   * 3. Saves default configuration to database
   * 4. Reloads configuration from database
   * 5. Updates state and sets isConfigured to true
   * 6. Sets status to 'ready'
   *
   * @example
   * ```ts
   * await runSetup()
   * // Application is now configured and ready to use
   * ```
   */
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
