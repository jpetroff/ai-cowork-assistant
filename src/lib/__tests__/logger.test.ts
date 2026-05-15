import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DEBUG_LOG_STORAGE_KEY = 'debug.log.labels'

function installMockWindow(storedLabels?: string) {
  const storage = new Map<string, string>()

  if (storedLabels) {
    storage.set(DEBUG_LOG_STORAGE_KEY, storedLabels)
  }

  const localStorage = {
    getItem(key: string) {
      return storage.get(key) ?? null
    },
    setItem(key: string, value: string) {
      storage.set(key, value)
    },
    removeItem(key: string) {
      storage.delete(key)
    },
  }

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage },
    writable: true,
  })
}

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules()
    Reflect.deleteProperty(globalThis, 'window')
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('reads stored labels and normalizes comparisons', async () => {
    installMockWindow('editor, db')

    const logger = await import('../logger')

    expect(logger.listDebugLogLabels()).toEqual(['EDITOR', 'DB'])
    expect(logger.isDebugLogEnabled('EDITOR')).toBe(true)
    expect(logger.isDebugLogEnabled('db')).toBe(true)
    expect(logger.isDebugLogEnabled('chat')).toBe(false)
  })

  it('supports runtime label switching through window.debugLogs', async () => {
    installMockWindow()

    const logger = await import('../logger')

    expect(window.debugLogs).toBe(logger.debugLogs)
    expect(window.debugLogs.only('editor')).toEqual(['EDITOR'])
    expect(window.localStorage.getItem(DEBUG_LOG_STORAGE_KEY)).toBe('EDITOR')
    expect(window.debugLogs.enable('db')).toEqual(['EDITOR', 'DB'])
    expect(window.debugLogs.disable('editor')).toEqual(['DB'])
    expect(window.debugLogs.clear()).toEqual([])
    expect(window.localStorage.getItem(DEBUG_LOG_STORAGE_KEY)).toBeNull()
  })

  it('supports enabling every label with a wildcard', async () => {
    installMockWindow()

    const logger = await import('../logger')

    expect(logger.debugLogs.enableAll()).toEqual(['*'])
    expect(logger.isDebugLogEnabled('editor')).toBe(true)
    expect(logger.isDebugLogEnabled('anything-else')).toBe(true)
  })
})
