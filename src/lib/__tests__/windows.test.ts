import { beforeEach, describe, expect, it, vi } from 'vitest'
import { startBackgroundJobCloseGuard } from '../windows'

const windowMock = vi.hoisted(() => {
  type CloseEvent = { preventDefault: () => void }
  type CloseHandler = (event: CloseEvent) => void | Promise<void>

  const state = {
    activeJobs: {} as Record<string, unknown>,
    closeHandler: null as CloseHandler | null,
    confirm: vi.fn(),
    currentLabel: 'main',
    onCloseRequested: vi.fn(),
    unlisten: vi.fn(),
  }

  state.onCloseRequested = vi.fn((handler: CloseHandler) => {
    state.closeHandler = handler
    return Promise.resolve(state.unlisten)
  })

  return state
})

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: windowMock.currentLabel }),
  Window: vi.fn(function Window() {
    return {
      onCloseRequested: windowMock.onCloseRequested,
    }
  }),
}))

vi.mock('@tauri-apps/api/dpi', () => ({
  LogicalSize: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: windowMock.confirm,
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

vi.mock('@/components/chat/backgroundGenerationStore', () => ({
  useBackgroundGenerationStore: {
    getState: () => ({ activeJobs: windowMock.activeJobs }),
  },
}))

beforeEach(() => {
  windowMock.activeJobs = {}
  windowMock.closeHandler = null
  windowMock.confirm.mockReset()
  windowMock.currentLabel = 'main'
  windowMock.onCloseRequested.mockClear()
  windowMock.unlisten.mockClear()
})

describe('startBackgroundJobCloseGuard', () => {
  it('does not register outside the main window', async () => {
    windowMock.currentLabel = 'splash'

    const unlisten = await startBackgroundJobCloseGuard()
    unlisten()

    expect(windowMock.onCloseRequested).not.toHaveBeenCalled()
    expect(windowMock.unlisten).not.toHaveBeenCalled()
  })

  it('allows closing without prompting when no background jobs are active', async () => {
    await startBackgroundJobCloseGuard()

    const preventDefault = vi.fn()
    await windowMock.closeHandler?.({ preventDefault })

    expect(windowMock.confirm).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('prevents closing when background jobs are active and the user cancels', async () => {
    windowMock.activeJobs = { 'conv-1': { projectId: 'proj-1' } }
    windowMock.confirm.mockResolvedValue(false)

    await startBackgroundJobCloseGuard()

    const preventDefault = vi.fn()
    await windowMock.closeHandler?.({ preventDefault })

    expect(windowMock.confirm).toHaveBeenCalledWith(
      'Background jobs are still running. Closing the application will interrupt them. Close anyway?',
      { title: 'Close application?', kind: 'warning' }
    )
    expect(preventDefault).toHaveBeenCalledOnce()
  })

  it('allows closing when background jobs are active and the user confirms', async () => {
    windowMock.activeJobs = { 'conv-1': { projectId: 'proj-1' } }
    windowMock.confirm.mockResolvedValue(true)

    await startBackgroundJobCloseGuard()

    const preventDefault = vi.fn()
    await windowMock.closeHandler?.({ preventDefault })

    expect(windowMock.confirm).toHaveBeenCalledOnce()
    expect(preventDefault).not.toHaveBeenCalled()
  })
})
