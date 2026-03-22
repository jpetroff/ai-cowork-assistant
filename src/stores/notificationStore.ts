import { create } from 'zustand'

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationKind = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  kind: NotificationKind
  message: string
  /** Full error detail shown in the details dialog */
  detail?: string
  /** Auto-dismiss after this many ms. Omit for manual-dismiss only (required for errors). */
  autoDismissMs?: number
}

interface NotificationState {
  notifications: Notification[]
}

interface NotificationActions {
  /**
   * Push a new notification. Returns the generated ID for programmatic dismissal.
   * Error notifications should omit `autoDismissMs` — they require manual close.
   */
  push: (n: Omit<Notification, 'id'>) => string
  /** Remove a single notification by ID. */
  dismiss: (id: string) => void
  /** Remove all notifications. */
  dismissAll: () => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationState & NotificationActions>((set) => ({
  notifications: [],

  push(n) {
    const id = crypto.randomUUID()
    set((s) => ({ notifications: [...s.notifications, { ...n, id }] }))

    if (n.autoDismissMs != null) {
      setTimeout(() => {
        set((s) => ({ notifications: s.notifications.filter((x) => x.id !== id) }))
      }, n.autoDismissMs)
    }

    return id
  },

  dismiss(id) {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }))
  },

  dismissAll() {
    set({ notifications: [] })
  },
}))
