const DEBUG_LOG_STORAGE_KEY = 'debug.log.labels'
const ENABLE_ALL_DEBUG_LABELS = '*'

const noop = () => {}
const noopConsoleConstructor = function () {} as unknown as Console['Console']

const noopConsole: Console = {
  Console: noopConsoleConstructor,
  assert: noop,
  clear: noop,
  count: noop,
  countReset: noop,
  debug: noop,
  dir: noop,
  dirxml: noop,
  error: noop,
  group: noop,
  groupCollapsed: noop,
  groupEnd: noop,
  info: noop,
  log: noop,
  profile: noop,
  profileEnd: noop,
  table: noop,
  time: noop,
  timeEnd: noop,
  timeLog: noop,
  timeStamp: noop,
  trace: noop,
  warn: noop,
}

function normalizeDebugLabel(label: string): string {
  return label.trim().toUpperCase()
}

function parseDebugLabels(raw: string | null | undefined): Set<string> {
  return new Set(
    (raw ?? '').split(',').map(normalizeDebugLabel).filter(Boolean)
  )
}

function readStoredDebugLabels(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage.getItem(DEBUG_LOG_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredDebugLabels(labels: Set<string>): void {
  if (typeof window === 'undefined') return

  try {
    if (labels.size === 0) {
      window.localStorage.removeItem(DEBUG_LOG_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(DEBUG_LOG_STORAGE_KEY, [...labels].join(','))
  } catch {
    // Ignore storage failures so debug utilities never break the app.
  }
}

function readInitialDebugLabels(): Set<string> {
  const storedLabels = parseDebugLabels(readStoredDebugLabels())
  if (storedLabels.size > 0) return storedLabels

  return parseDebugLabels(
    import.meta.env.VITE_DEBUG_LOG_LABELS ?? import.meta.env.VITE_LOGGER
  )
}

let enabledDebugLabels = readInitialDebugLabels()

export function listDebugLogLabels(): string[] {
  return [...enabledDebugLabels]
}

export function isDebugLogEnabled(label: string): boolean {
  const normalizedLabel = normalizeDebugLabel(label)

  return (
    enabledDebugLabels.has(ENABLE_ALL_DEBUG_LABELS) ||
    enabledDebugLabels.has(normalizedLabel)
  )
}

export function console_if(label: string): Console {
  return isDebugLogEnabled(label) ? console : noopConsole
}

export function setDebugLogLabels(labels: string | string[]): string[] {
  enabledDebugLabels = Array.isArray(labels)
    ? new Set(labels.map(normalizeDebugLabel).filter(Boolean))
    : parseDebugLabels(labels)

  writeStoredDebugLabels(enabledDebugLabels)

  return listDebugLogLabels()
}

export function enableDebugLogLabels(...labels: string[]): string[] {
  const nextLabels = new Set(enabledDebugLabels)

  for (const label of labels.map(normalizeDebugLabel).filter(Boolean)) {
    nextLabels.add(label)
  }

  enabledDebugLabels = nextLabels
  writeStoredDebugLabels(enabledDebugLabels)

  return listDebugLogLabels()
}

export function disableDebugLogLabels(...labels: string[]): string[] {
  const labelsToDisable = new Set(
    labels.map(normalizeDebugLabel).filter(Boolean)
  )
  enabledDebugLabels = new Set(
    [...enabledDebugLabels].filter((label) => !labelsToDisable.has(label))
  )

  writeStoredDebugLabels(enabledDebugLabels)

  return listDebugLogLabels()
}

export function clearDebugLogLabels(): string[] {
  enabledDebugLabels = new Set()
  writeStoredDebugLabels(enabledDebugLabels)

  return listDebugLogLabels()
}

export function reloadDebugLogLabels(): string[] {
  enabledDebugLabels = readInitialDebugLabels()

  return listDebugLogLabels()
}

export interface DebugLogControls {
  clear: typeof clearDebugLogLabels
  disable: typeof disableDebugLogLabels
  enable: typeof enableDebugLogLabels
  enableAll: () => string[]
  isEnabled: typeof isDebugLogEnabled
  list: typeof listDebugLogLabels
  only: (...labels: string[]) => string[]
  reload: typeof reloadDebugLogLabels
}

export const debugLogs: DebugLogControls = {
  clear: clearDebugLogLabels,
  disable: disableDebugLogLabels,
  enable: enableDebugLogLabels,
  enableAll: () => setDebugLogLabels(ENABLE_ALL_DEBUG_LABELS),
  isEnabled: isDebugLogEnabled,
  list: listDebugLogLabels,
  only: (...labels: string[]) => setDebugLogLabels(labels),
  reload: reloadDebugLogLabels,
}

declare global {
  interface Window {
    debugLogs: DebugLogControls
  }
}

if (typeof window !== 'undefined') {
  window.debugLogs = debugLogs
}
