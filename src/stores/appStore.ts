import { create } from 'zustand'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { initSidecar } from '@/lib/sidecar'
import { listLlmProviders } from '@/lib/db/repositories'
import { openMainWindow, getSplashWindow, currentWindowLabel } from '@/lib/windows'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppPhase = 'booting' | 'setup' | 'loading' | 'ready' | 'error'

export interface StartupStep {
  id: string
  label: string
  status: 'pending' | 'loading' | 'done' | 'error'
  error?: string
}

interface AppState {
  appPhase: AppPhase
  startupSteps: StartupStep[]
  sidcarStatus: 'idle' | 'starting' | 'ready' | 'error'
  sidcarUrl: string | null
  sidcarError: string | null
  bootError: string | null
  isFirstRun: boolean

  init: () => Promise<void>
  onSetupComplete: () => void
  retry: () => void
  /** @internal used by health-check loop to update state */
  _setSidcarReady: (url: string) => void
  /** @internal used by health-check loop on failure */
  _setSidcarError: (error: string) => void
  /** @internal updates a single startup step field */
  _updateStep: (id: string, patch: Partial<StartupStep>) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SIDECAR_STEP_ID = 'sidecar'
const POLL_INTERVAL_MS = 500
const TIMEOUT_MS = 15_000
const SLOW_THRESHOLD_MS = 5_000
const MIN_SPLASH_MS = 300

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function makeSidecarStep(status: StartupStep['status'] = 'pending'): StartupStep {
  return { id: SIDECAR_STEP_ID, label: 'Starting AI engine…', status }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  appPhase: 'booting',
  startupSteps: [],
  sidcarStatus: 'idle',
  sidcarUrl: null,
  sidcarError: null,
  bootError: null,
  isFirstRun: false,

  // ── Internal helpers ──────────────────────────────────────────────────────

  _updateStep(id, patch) {
    set((s) => ({
      startupSteps: s.startupSteps.map((step) =>
        step.id === id ? { ...step, ...patch } : step
      ),
    }))
  },

  _setSidcarReady(url) {
    const { appPhase, _updateStep } = get()
    _updateStep(SIDECAR_STEP_ID, { status: 'done' })
    set({ sidcarStatus: 'ready', sidcarUrl: url })
    if (appPhase === 'loading') {
      set({ appPhase: 'ready' })
      if (currentWindowLabel() === 'splash') {
        // Normal boot: open main then close splash
        openMainWindow().then(() => getSplashWindow().close().catch(() => {}))
      }
      // Main window: appPhase='ready' triggers AppShell navigation, no window ops needed
    }
  },

  _setSidcarError(error) {
    const { _updateStep } = get()
    _updateStep(SIDECAR_STEP_ID, { status: 'error', error })
    set({ sidcarStatus: 'error', sidcarError: error, appPhase: 'error', bootError: error })
  },

  // ── Actions ───────────────────────────────────────────────────────────────

  async init() {
    const splashStart = Date.now()

    // 1. Invoke sidecar (fire — health check runs in background)
    const sidecarPromise = initSidecar()

    // 2. DB check — runs concurrently with sidecar init
    const [sidecarInfo, providers] = await Promise.all([
      sidecarPromise,
      listLlmProviders(),
    ])

    const isFirstRun = providers.length === 0

    if (sidecarInfo.available && sidecarInfo.url) {
      set({ sidcarUrl: sidecarInfo.url, sidcarStatus: 'starting' })
    } else {
      const err = sidecarInfo.error ?? 'Sidecar failed to start'
      set({ sidcarStatus: 'error', sidcarError: err })
    }

    // 3. Enforce minimum splash display time
    const elapsed = Date.now() - splashStart
    if (elapsed < MIN_SPLASH_MS) {
      await sleep(MIN_SPLASH_MS - elapsed)
    }

    // 4. Determine next phase
    set({ isFirstRun })

    if (isFirstRun) {
      // Setup page fills the time while sidecar starts in the background
      set({ appPhase: 'setup' })
      if (currentWindowLabel() === 'splash') {
        await openMainWindow()
        getSplashWindow().close().catch(() => {})
        // Start health check in background (non-blocking)
        if (sidecarInfo.url) runHealthCheck(sidecarInfo.url)
      }
    } else if (currentWindowLabel() === 'splash') {
      // Normal boot: show splash loading steps, wait for sidecar
      set({
        appPhase: 'loading',
        startupSteps: [makeSidecarStep('loading')],
      })
      if (sidecarInfo.url) {
        runHealthCheck(sidecarInfo.url)
      } else {
        const err = sidecarInfo.error ?? 'Sidecar unavailable'
        get()._setSidcarError(err)
      }
    }
  },

  onSetupComplete() {
    const { sidcarStatus, sidcarUrl } = get()
    if (sidcarStatus === 'ready') {
      set({ appPhase: 'ready' })
    } else {
      // Sidecar still starting: show loading overlay and run health check from main window
      // (splash is already closed so its health check loop is gone)
      set({ appPhase: 'loading', startupSteps: [makeSidecarStep('loading')] })
      if (sidcarUrl) {
        runHealthCheck(sidcarUrl)
      } else {
        initSidecar().then((info) => {
          if (info.url) {
            set({ sidcarUrl: info.url, sidcarStatus: 'starting' })
            runHealthCheck(info.url)
          } else {
            get()._setSidcarError(info.error ?? 'Sidecar unavailable')
          }
        })
      }
    }
  },

  retry() {
    const { sidcarUrl, startupSteps } = get()
    const failedSteps = startupSteps.map((s) =>
      s.status === 'error' ? { ...s, status: 'loading' as const, error: undefined } : s
    )
    set({ appPhase: 'loading', bootError: null, startupSteps: failedSteps })
    if (sidcarUrl) {
      set({ sidcarStatus: 'starting', sidcarError: null })
      runHealthCheck(sidcarUrl)
    } else {
      // Re-init from scratch if no url was ever obtained
      get().init()
    }
  },
}))

// ── Health check loop (runs outside store, calls store actions) ───────────────

async function runHealthCheck(url: string): Promise<void> {
  const start = Date.now()
  let slowWarningShown = false
  const { _updateStep, _setSidcarReady, _setSidcarError } = useAppStore.getState()

  while (true) {
    const elapsed = Date.now() - start

    if (elapsed >= TIMEOUT_MS) {
      _setSidcarError(`Sidecar did not respond after ${TIMEOUT_MS / 1000}s. Is it running?`)
      return
    }

    if (!slowWarningShown && elapsed >= SLOW_THRESHOLD_MS) {
      slowWarningShown = true
      _updateStep(SIDECAR_STEP_ID, { label: 'Starting AI engine… (taking longer than expected)' })
    }

    try {
      const response = await tauriFetch(`${url}/health`)
      if (response.ok) {
        _setSidcarReady(url)
        return
      }
    } catch {
      // Network error — sidecar not up yet, keep polling
    }

    await sleep(POLL_INTERVAL_MS)
  }
}
