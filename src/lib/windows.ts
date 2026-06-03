import { getCurrentWindow, Window } from '@tauri-apps/api/window'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { confirm } from '@tauri-apps/plugin-dialog'
import { useBackgroundGenerationStore } from '@/components/chat/backgroundGenerationStore'
import { getSetting, setSetting } from './db/settings'

const MAIN_LABEL = 'main'
const SPLASH_LABEL = 'splash'

const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 800
const MIN_WIDTH = 800
const MIN_HEIGHT = 600

// ── Window accessors ──────────────────────────────────────────────────────────

export function getMainWindow(): Window {
  return new Window(MAIN_LABEL)
}

export function getSplashWindow(): Window {
  return new Window(SPLASH_LABEL)
}

export function currentWindowLabel(): string {
  return getCurrentWindow().label
}

// ── Open main window at saved or default size ─────────────────────────────────

/**
 * Read persisted dimensions, resize the main window to them, then show it.
 * Call this from appStore when the boot sequence completes.
 */
export async function openMainWindow(): Promise<void> {
  const [rawW, rawH] = await Promise.all([
    getSetting('main_window_width'),
    getSetting('main_window_height'),
  ])

  const width = Math.max(
    parseInt(rawW ?? String(DEFAULT_WIDTH), 10) || DEFAULT_WIDTH,
    MIN_WIDTH
  )
  const height = Math.max(
    parseInt(rawH ?? String(DEFAULT_HEIGHT), 10) || DEFAULT_HEIGHT,
    MIN_HEIGHT
  )

  const main = getMainWindow()
  await main.setSize(new LogicalSize(width, height))
  await main.center()
  await main.show()
}

// ── Window size persistence ───────────────────────────────────────────────────

let _persistDebounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Subscribe to resize events on the main window and persist dimensions.
 * Call once from App.tsx after mount. Returns an unlisten function.
 */
export async function startWindowSizePersistence(): Promise<() => void> {
  const main = getMainWindow()

  const unlisten = await main.onResized(({ payload: size }) => {
    if (_persistDebounceTimer !== null) clearTimeout(_persistDebounceTimer)
    _persistDebounceTimer = setTimeout(async () => {
      const w = Math.max(size.width, MIN_WIDTH)
      const h = Math.max(size.height, MIN_HEIGHT)
      await Promise.all([
        setSetting('main_window_width', String(w)),
        setSetting('main_window_height', String(h)),
      ])
    }, 500)
  })

  return unlisten
}

// ── Background job close guard ────────────────────────────────────────────────

/**
 * Prompt before closing the main window while background generation is active.
 * Returns an unlisten function for React effect cleanup.
 */
export async function startBackgroundJobCloseGuard(): Promise<() => void> {
  if (currentWindowLabel() !== MAIN_LABEL) return () => {}

  const main = getMainWindow()

  return main.onCloseRequested(async (event) => {
    const hasActiveJobs =
      Object.keys(useBackgroundGenerationStore.getState().activeJobs).length > 0

    if (!hasActiveJobs) return

    const shouldClose = await confirm(
      'Background jobs are still running. Closing the application will interrupt them. Close anyway?',
      { title: 'Close application?', kind: 'warning' }
    )

    if (!shouldClose) {
      event.preventDefault()
    }
  })
}
