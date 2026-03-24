import { create } from 'zustand'
import { listMessages, createMessage } from '@/lib/db/repositories/messages'
import type { Message } from '@/lib/db/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

interface MessageState {
  messages: Message[]
  conversationId: string | null
  status: StoreStatus
  isStreaming: boolean
  streamingContent: string
  streamingMessageId: string | null
}

interface MessageActions {
  /**
   * Load all messages for a conversation from SQLite.
   * Called by the chat route loader. Replaces any previously loaded list.
   */
  loadForConversation: (id: string) => Promise<void>
  /**
   * Create a new user message in SQLite and append to the list.
   */
  addUserMessage: (content: string) => Promise<void>
  /**
   * Reset all state to initial values.
   */
  clear: () => void
  /**
   * Begin an AI streaming response.
   * TODO: wire to sidecar WebSocket (sidecar integration)
   */
  beginStreaming: () => void
  /**
   * Append a chunk of streamed content.
   * TODO: wire to sidecar WebSocket chunk event (sidecar integration)
   */
  appendChunk: (chunk: string) => void
  /**
   * Finalize the streaming response — persist to DB and add to messages list.
   * TODO: wire to sidecar WebSocket done event (sidecar integration)
   */
  finalizeStreaming: (id: string, content: string) => void
}

const INITIAL_STATE: MessageState = {
  messages: [],
  conversationId: null,
  status: 'idle',
  isStreaming: false,
  streamingContent: '',
  streamingMessageId: null,
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useMessageStore = create<MessageState & MessageActions>((set, get) => ({
  ...INITIAL_STATE,

  async loadForConversation(id) {
    set({ status: 'loading', conversationId: id, messages: [] })
    try {
      const messages = await listMessages(id)
      set({ messages, status: 'ready' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load messages'
      console.error('[messageStore] loadForConversation error:', message)
      set({ status: 'error' })
    }
  },

  async addUserMessage(content) {
    const { conversationId, messages } = get()
    if (!conversationId) return
    const sequence_order = messages.length > 0 ? messages[messages.length - 1].sequence_order + 1 : 0
    const id = await createMessage({ conversation_id: conversationId, role: 'user', content, sequence_order })
    const newMessage: Message = {
      id,
      conversation_id: conversationId,
      role: 'user',
      content,
      sequence_order,
      created_at: Date.now(),
    }
    set((s) => ({ messages: [...s.messages, newMessage] }))
  },

  clear() {
    set(INITIAL_STATE)
  },

  beginStreaming() {
    set({ isStreaming: true, streamingContent: '', streamingMessageId: null })
  },

  appendChunk(chunk) {
    set((s) => ({ streamingContent: s.streamingContent + chunk }))
  },

  finalizeStreaming(id, content) {
    const { conversationId, messages } = get()
    if (!conversationId) {
      set({ isStreaming: false, streamingContent: '', streamingMessageId: null })
      return
    }
    if (id && content) {
      const newMessage = {
        id,
        conversation_id: conversationId,
        role: 'assistant' as const,
        content,
        sequence_order: messages.length,
        created_at: Date.now(),
      }
      set((s) => ({
        messages: [...s.messages, newMessage],
        isStreaming: false,
        streamingContent: '',
        streamingMessageId: null,
      }))
    } else {
      set({ isStreaming: false, streamingContent: '', streamingMessageId: null })
    }
  },
}))
