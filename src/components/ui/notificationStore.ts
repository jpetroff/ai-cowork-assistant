import { create } from 'zustand'

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationKind = 'info' | 'success' | 'warning' | 'error'

/** @property label - button text shown in the toast */
/** @property to - app route opened when the action is clicked */
interface NotificationAction {
  label: string
  to: string
}

/** @property id - generated notification identifier */
/** @property kind - notification visual treatment */
/** @property message - primary toast text */
/** @property detail - full error detail shown in the details dialog */
/** @property action - optional route action shown beside dismiss */
/** @property autoDismissMs - delay before automatic dismissal */
export interface Notification {
  id: string
  kind: NotificationKind
  message: string
  detail?: string
  action?: NotificationAction
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

export const useNotificationStore = create<
  NotificationState & NotificationActions
>((set) => ({
  notifications: [],

  push(n) {
    const id = crypto.randomUUID()
    set((s) => ({ notifications: [...s.notifications, { ...n, id }] }))

    if (n.autoDismissMs != null) {
      setTimeout(() => {
        set((s) => ({
          notifications: s.notifications.filter((x) => x.id !== id),
        }))
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
