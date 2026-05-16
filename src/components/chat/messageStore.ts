import { create } from 'zustand'
import {
  listMessages,
  createMessage,
  createSystemRevisionMessage,
} from '@/lib/db/repositories/messages'
import type { Message } from '@/lib/db/types'
import type { RevisionMessageMetadata } from '@/lib/types'
import { console_if } from '@/lib/logger'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

/** @property messages - messages loaded for the active conversation */
/** @property conversationId - active conversation loaded into this store */
/** @property status - lifecycle state for message loading */
/** @property isStreaming - whether an assistant stream is currently visible */
/** @property streamingContent - accumulated assistant stream content */
/** @property streamingMessageId - reserved assistant stream message id */
export interface MessageState {
  messages: Message[]
  conversationId: string | null
  status: StoreStatus
  isStreaming: boolean
  streamingContent: string
  streamingMessageId: string | null
}

export interface MessageActions {
  loadForConversation: (id: string) => Promise<void>
  addUserMessage: (content: string) => Promise<void>
  clear: () => void
  beginStreaming: () => void
  appendChunk: (chunk: string) => void
  finalizeStreaming: (
    id: string | null,
    content: string
  ) => Promise<string | null>
  addSystemRevisionMessage: (
    author: 'user' | 'ai',
    artifactId: string,
    revisionId: string
  ) => Promise<string>
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

export const useMessageStore = create<MessageState & MessageActions>(
  (set, get) => ({
    ...INITIAL_STATE,

    /**
     * Loads all messages for a conversation from SQLite and replaces previous chat
     * state. Artifact/editor state is loaded separately by chatSessionStore.
     */
    async loadForConversation(id) {
      console_if('MESSAGE_STORE').log('[MESSAGE_STORE] load:start', {
        conversationId: id,
      })
      set({ status: 'loading', conversationId: id, messages: [] })
      try {
        const messages = await listMessages(id)
        set({ messages, status: 'ready' })
        console_if('MESSAGE_STORE').log('[MESSAGE_STORE] load:ready', {
          conversationId: id,
          messageCount: messages.length,
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load messages'
        console.error('[MESSAGE_STORE] load:error', message)
        set({ status: 'error' })
      }
    },

    /**
     * Persists a user message to SQLite and appends it to the loaded conversation.
     * No sidecar or artifact work happens here.
     */
    async addUserMessage(content) {
      const { conversationId, messages } = get()
      if (!conversationId) return
      const sequence_order =
        messages.length > 0
          ? messages[messages.length - 1].sequence_order + 1
          : 0
      const id = await createMessage({
        conversation_id: conversationId,
        role: 'user',
        content,
        sequence_order,
      })
      const newMessage: Message = {
        id,
        conversation_id: conversationId,
        role: 'user',
        content,
        metadata: null,
        sequence_order,
        created_at: Date.now(),
      }
      set((s) => ({ messages: [...s.messages, newMessage] }))
      console_if('MESSAGE_STORE').log('[MESSAGE_STORE] user-message:created', {
        conversationId,
        messageId: id,
      })
    },

    /**
     * Clears message and streaming state. Used when leaving or reloading chat context.
     */
    clear() {
      set(INITIAL_STATE)
    },

    /**
     * Opens a visible assistant streaming slot before sidecar chunks arrive.
     */
    beginStreaming() {
      console_if('MESSAGE_STORE').log('[MESSAGE_STORE] stream:begin')
      set({ isStreaming: true, streamingContent: '', streamingMessageId: null })
    },

    /**
     * Appends one sidecar text chunk to the visible streaming assistant response.
     */
    appendChunk(chunk) {
      set((s) => ({ streamingContent: s.streamingContent + chunk }))
    },

    /**
     * Closes the streaming slot and appends the final assistant message. If the sidecar
     * did not return an ID, this method persists the assistant message itself.
     */
    async finalizeStreaming(id, content) {
      const { conversationId, messages } = get()
      if (!conversationId) {
        set({
          isStreaming: false,
          streamingContent: '',
          streamingMessageId: null,
        })
        return null
      }
      if (content) {
        const sequence_order = messages.length
        const messageId =
          id ??
          (await createMessage({
            conversation_id: conversationId,
            role: 'assistant',
            content,
            sequence_order,
          }))
        const newMessage: Message = {
          id: messageId,
          conversation_id: conversationId,
          role: 'assistant',
          content,
          metadata: null,
          sequence_order,
          created_at: Date.now(),
        }
        set((s) => ({
          messages: [...s.messages, newMessage],
          isStreaming: false,
          streamingContent: '',
          streamingMessageId: null,
        }))
        console_if('MESSAGE_STORE').log('[MESSAGE_STORE] stream:finalized', {
          conversationId,
          messageId,
        })
        return messageId
      } else {
        set({
          isStreaming: false,
          streamingContent: '',
          streamingMessageId: null,
        })
        return null
      }
    },

    /**
     * Creates a system message anchoring an artifact revision in the thread. This is
     * called by chatSessionStore so artifactStore does not own message side effects.
     */
    async addSystemRevisionMessage(author, artifactId, revisionId) {
      const { conversationId, messages } = get()
      if (!conversationId) throw new Error('No active conversation')
      const sequence_order =
        messages.length > 0
          ? messages[messages.length - 1].sequence_order + 1
          : 0
      const id = await createSystemRevisionMessage({
        conversation_id: conversationId,
        author,
        artifactId,
        revisionId,
        sequence_order,
      })
      const metadata: RevisionMessageMetadata = {
        artifactId,
        revisionId,
        author,
      }
      const newMessage: Message = {
        id,
        conversation_id: conversationId,
        role: 'system',
        content: `${author} created artifact revision`,
        metadata: JSON.stringify(metadata),
        sequence_order,
        created_at: Date.now(),
      }
      set((s) => ({ messages: [...s.messages, newMessage] }))
      console_if('MESSAGE_STORE').log(
        '[MESSAGE_STORE] revision-message:created',
        {
          conversationId,
          messageId: id,
          artifactId,
          revisionId,
          author,
        }
      )
      return id
    },
  })
)
