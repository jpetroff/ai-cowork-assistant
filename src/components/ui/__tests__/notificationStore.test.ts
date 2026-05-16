import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNotificationStore } from '../notificationStore'

beforeEach(() => {
  useNotificationStore.getState().dismissAll()
  vi.restoreAllMocks()
})

describe('push()', () => {
  it('adds a notification and returns its ID', () => {
    const id = useNotificationStore
      .getState()
      .push({ kind: 'info', message: 'Hello' })
    const { notifications } = useNotificationStore.getState()
    expect(notifications).toHaveLength(1)
    expect(notifications[0].id).toBe(id)
    expect(notifications[0].message).toBe('Hello')
    expect(notifications[0].kind).toBe('info')
  })

  it('preserves detail field', () => {
    useNotificationStore
      .getState()
      .push({ kind: 'error', message: 'Oops', detail: 'Full trace' })
    expect(useNotificationStore.getState().notifications[0].detail).toBe(
      'Full trace'
    )
  })

  it('generates unique IDs for concurrent pushes', () => {
    const id1 = useNotificationStore
      .getState()
      .push({ kind: 'info', message: 'A' })
    const id2 = useNotificationStore
      .getState()
      .push({ kind: 'info', message: 'B' })
    expect(id1).not.toBe(id2)
    expect(useNotificationStore.getState().notifications).toHaveLength(2)
  })
})

describe('dismiss()', () => {
  it('removes only the notification with the given ID', () => {
    const id1 = useNotificationStore
      .getState()
      .push({ kind: 'info', message: 'A' })
    const id2 = useNotificationStore
      .getState()
      .push({ kind: 'info', message: 'B' })
    useNotificationStore.getState().dismiss(id1)
    const { notifications } = useNotificationStore.getState()
    expect(notifications).toHaveLength(1)
    expect(notifications[0].id).toBe(id2)
  })

  it('is a no-op for unknown IDs', () => {
    useNotificationStore.getState().push({ kind: 'info', message: 'A' })
    useNotificationStore.getState().dismiss('non-existent')
    expect(useNotificationStore.getState().notifications).toHaveLength(1)
  })
})

describe('dismissAll()', () => {
  it('clears all notifications', () => {
    useNotificationStore.getState().push({ kind: 'info', message: 'A' })
    useNotificationStore.getState().push({ kind: 'error', message: 'B' })
    useNotificationStore.getState().dismissAll()
    expect(useNotificationStore.getState().notifications).toHaveLength(0)
  })
})

describe('autoDismissMs', () => {
  it('removes the notification after the specified delay', async () => {
    vi.useFakeTimers()
    useNotificationStore
      .getState()
      .push({ kind: 'success', message: 'Done', autoDismissMs: 500 })
    expect(useNotificationStore.getState().notifications).toHaveLength(1)
    vi.advanceTimersByTime(500)
    expect(useNotificationStore.getState().notifications).toHaveLength(0)
    vi.useRealTimers()
  })

  it('does not auto-dismiss when autoDismissMs is omitted', async () => {
    vi.useFakeTimers()
    useNotificationStore
      .getState()
      .push({ kind: 'error', message: 'Persistent' })
    vi.advanceTimersByTime(60_000)
    expect(useNotificationStore.getState().notifications).toHaveLength(1)
    vi.useRealTimers()
  })
})
