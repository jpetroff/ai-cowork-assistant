import { create } from 'zustand'
import {
  listConversations,
  createConversation,
  updateConversation,
  deleteConversation,
} from '@/lib/db/repositories/conversations'
import type { Conversation } from '@/lib/db/types'
import { useNotificationStore } from './notificationStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ConversationOp = 'renaming' | 'deleting'

interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  activeProjectId: string | null
  status: StoreStatus
  error: string | null
  /** Maps conversation ID → in-flight operation kind. Row is disabled while set. */
  operationStates: Record<string, ConversationOp>
}

interface ConversationActions {
  /**
   * Load all conversations for a project from SQLite.
   * Called by the project route loader. Replaces any previously loaded list.
   */
  loadForProject: (projectId: string) => Promise<void>
  /**
   * Create a new conversation for the given project.
   * Returns the new Conversation on success. Caller is responsible for navigation.
   */
  create: (projectId: string) => Promise<Conversation | null>
  /**
   * Rename a conversation. DB-first with operationStates guard.
   */
  rename: (id: string, title: string) => Promise<void>
  /**
   * Delete a conversation. DB-first with operationStates guard.
   */
  delete: (id: string) => Promise<void>
  /** Set the active conversation ID (used when navigating into a chat). */
  setActive: (id: string) => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useConversationStore = create<ConversationState & ConversationActions>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  activeProjectId: null,
  status: 'idle',
  error: null,
  operationStates: {},

  async loadForProject(projectId) {
    set({ status: 'loading', error: null, activeProjectId: projectId, conversations: [] })
    try {
      const conversations = await listConversations(projectId)
      set({ conversations, status: 'ready' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load conversations'
      set({ status: 'error', error: message })
    }
  },

  async create(projectId) {
    try {
      const id = await createConversation({ project_id: projectId })
      const conversation: Conversation = {
        id,
        project_id: projectId,
        title: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }
      set((s) => ({ conversations: [conversation, ...s.conversations] }))
      return conversation
    } catch (err) {
      useNotificationStore.getState().push({
        kind: 'error',
        message: 'Could not create conversation',
        detail: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  },

  async rename(id, title) {
    const { operationStates } = get()
    if (operationStates[id]) return

    set((s) => ({ operationStates: { ...s.operationStates, [id]: 'renaming' } }))
    try {
      await updateConversation(id, { title })
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, title, updated_at: Date.now() } : c
        ),
        operationStates: omit(s.operationStates, id),
      }))
    } catch (err) {
      set((s) => ({ operationStates: omit(s.operationStates, id) }))
      useNotificationStore.getState().push({
        kind: 'error',
        message: 'Could not rename conversation',
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  },

  async delete(id) {
    const { operationStates } = get()
    if (operationStates[id]) return

    set((s) => ({ operationStates: { ...s.operationStates, [id]: 'deleting' } }))
    try {
      await deleteConversation(id)
      set((s) => ({
        conversations: s.conversations.filter((c) => c.id !== id),
        operationStates: omit(s.operationStates, id),
      }))
    } catch (err) {
      set((s) => ({ operationStates: omit(s.operationStates, id) }))
      useNotificationStore.getState().push({
        kind: 'error',
        message: 'Could not delete conversation',
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  },

  setActive(id) {
    set({ activeConversationId: id })
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  const { [key]: _, ...rest } = obj
  return rest as T
}
