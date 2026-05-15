import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DEBUG_LOG_STORAGE_KEY = 'debug.log.labels'
const CONSOLE_METHODS = [
  'assert',
  'clear',
  'count',
  'countReset',
  'debug',
  'dir',
  'dirxml',
  'error',
  'group',
  'groupCollapsed',
  'groupEnd',
  'info',
  'log',
  'profile',
  'profileEnd',
  'table',
  'time',
  'timeEnd',
  'timeLog',
  'timeStamp',
  'trace',
  'warn',
] as const

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
    vi.restoreAllMocks()
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

  it('returns the real console only for enabled labels', async () => {
    installMockWindow('editor')

    const logger = await import('../logger')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    expect(logger.console_if('EDITOR')).toBe(console)
    logger.console_if('EDITOR').log('visible')
    expect(logSpy).toHaveBeenCalledWith('visible')

    logSpy.mockClear()

    const disabledConsole = logger.console_if('DB')
    expect(disabledConsole).not.toBe(console)
    disabledConsole.log('hidden')
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('provides no-op console methods for disabled labels', async () => {
    installMockWindow()

    const logger = await import('../logger')
    logger.debugLogs.only('DB')
    const disabledConsole = logger.console_if('EDITOR')

    for (const method of CONSOLE_METHODS) {
      expect(typeof disabledConsole[method]).toBe('function')
      expect(() =>
        (disabledConsole[method] as (...args: unknown[]) => void)('ignored')
      ).not.toThrow()
    }
  })
})
