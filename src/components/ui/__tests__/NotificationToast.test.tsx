// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNotificationStore } from '@/components/ui/notificationStore'
import { NotificationToast } from '../NotificationToast'

afterEach(cleanup)

beforeEach(() => {
  useNotificationStore.getState().dismissAll()
})

describe('NotificationToast', () => {
  it('renders nothing when there are no notifications', () => {
    const { container } = render(<NotificationToast />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a notification message', () => {
    useNotificationStore
      .getState()
      .push({ kind: 'info', message: 'Background sync started' })
    render(<NotificationToast />)
    expect(screen.getByText('Background sync started')).toBeTruthy()
  })

  it('renders up to 5 notifications (shows last 5)', () => {
    for (let i = 1; i <= 7; i++) {
      useNotificationStore
        .getState()
        .push({ kind: 'info', message: `Message ${i}` })
    }
    render(<NotificationToast />)
    expect(screen.queryByText('Message 1')).toBeNull()
    expect(screen.queryByText('Message 2')).toBeNull()
    expect(screen.getByText('Message 3')).toBeTruthy()
    expect(screen.getByText('Message 7')).toBeTruthy()
  })

  it('close button dismisses the notification', async () => {
    useNotificationStore.getState().push({ kind: 'info', message: 'Closeable' })
    render(<NotificationToast />)

    expect(screen.getByText('Closeable')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText('Closeable')).toBeNull()
    expect(useNotificationStore.getState().notifications).toHaveLength(0)
  })

  it('shows [details] link only for notifications with detail', () => {
    useNotificationStore
      .getState()
      .push({ kind: 'error', message: 'Error occurred' })
    useNotificationStore.getState().push({
      kind: 'error',
      message: 'Error with detail',
      detail: 'Full stack trace here',
    })
    render(<NotificationToast />)

    const detailsLinks = screen.getAllByText('details')
    expect(detailsLinks).toHaveLength(1)
  })

  it('opens details dialog with full error text on [details] click', async () => {
    useNotificationStore.getState().push({
      kind: 'error',
      message: 'Something failed',
      detail: 'Full error: ENOENT /path/to/file',
    })
    render(<NotificationToast />)

    await userEvent.click(screen.getByText('details'))

    expect(screen.getByText('Full error: ENOENT /path/to/file')).toBeTruthy()
    expect(screen.getByRole('button', { name: /copy/i })).toBeTruthy()
  })

  it('copy button writes detail to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    useNotificationStore.getState().push({
      kind: 'error',
      message: 'Oops',
      detail: 'Clipboard content',
    })
    render(<NotificationToast />)

    await userEvent.click(screen.getByText('details'))
    await userEvent.click(screen.getByRole('button', { name: /copy/i }))

    expect(writeText).toHaveBeenCalledWith('Clipboard content')
  })
})
