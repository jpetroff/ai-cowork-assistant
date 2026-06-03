import { create } from 'zustand'
import { listMessages, createMessage } from '@/lib/db/repositories/messages'
import type { Message } from '@/lib/db/types'
import { console_if } from '@/lib/logger'
import type { GenerationMetadata, MessageMetadata } from './generationMetadata'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

/** @property messages - messages loaded for the active conversation */
/** @property conversationId - active conversation loaded into this store */
/** @property status - lifecycle state for message loading */
/** @property isStreaming - whether an assistant stream is currently visible */
/** @property streamingContent - accumulated assistant stream content */
/** @property streamingMessageId - reserved assistant stream message id */
/** @property streamingGeneration - live generation step timeline */
export interface MessageState {
  messages: Message[]
  conversationId: string | null
  status: StoreStatus
  isStreaming: boolean
  streamingContent: string
  streamingMessageId: string | null
  streamingGeneration: GenerationMetadata | null
}

export interface MessageActions {
  loadForConversation: (id: string) => Promise<void>
  addUserMessage: (content: string) => Promise<string | null>
  upsertMessage: (message: Message) => void
  patchMessage: (message: Message) => void
  clear: () => void
  beginStreaming: () => void
  appendChunk: (chunk: string) => void
  setStreamingGeneration: (generation: GenerationMetadata) => void
  finalizeStreaming: (
    id: string | null,
    content: string,
    metadata?: MessageMetadata
  ) => Promise<string | null>
}

const INITIAL_STATE: MessageState = {
  messages: [],
  conversationId: null,
  status: 'idle',
  isStreaming: false,
  streamingContent: '',
  streamingMessageId: null,
  streamingGeneration: null,
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
      if (!conversationId) return null
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
      return id
    },

    /**
     * Inserts or replaces a message in the visible conversation only. Background
     * streaming owns persistence and calls this to wake open chat views.
     */
    upsertMessage(message) {
      const { conversationId } = get()
      if (conversationId !== message.conversation_id) return

      set((state) => {
        const exists = state.messages.some((item) => item.id === message.id)
        const messages = exists
          ? state.messages.map((item) =>
              item.id === message.id ? message : item
            )
          : [...state.messages, message]

        return {
          messages: messages.sort(
            (a, b) => a.sequence_order - b.sequence_order
          ),
        }
      })
    },

    /**
     * Replaces a visible message row when it is already loaded.
     */
    patchMessage(message) {
      const { conversationId } = get()
      if (conversationId !== message.conversation_id) return

      set((state) => ({
        messages: state.messages.map((item) =>
          item.id === message.id ? message : item
        ),
      }))
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
      set({
        isStreaming: true,
        streamingContent: '',
        streamingMessageId: null,
        streamingGeneration: {
          startedAt: Date.now(),
          steps: [],
        },
      })
    },

    /**
     * Appends one sidecar text chunk to the visible streaming assistant response.
     */
    appendChunk(chunk) {
      set((s) => ({ streamingContent: s.streamingContent + chunk }))
    },

    /**
     * Replaces the visible generation timeline with the latest sidecar step
     * snapshot. Sidecar parsing keeps the immutable metadata shape ready for
     * persistence when the assistant message is finalized.
     */
    setStreamingGeneration(generation) {
      set({ streamingGeneration: generation })
    },

    /**
     * Closes the streaming slot and appends the final assistant message. If the sidecar
     * did not return an ID, this method persists the assistant message itself.
     */
    async finalizeStreaming(id, content, metadata) {
      const { conversationId, messages } = get()
      if (!conversationId) {
        set({
          isStreaming: false,
          streamingContent: '',
          streamingMessageId: null,
          streamingGeneration: null,
        })
        return null
      }
      if (content) {
        const sequence_order = messages.length
        const serializedMetadata =
          metadata && Object.keys(metadata).length > 0 ? metadata : undefined
        const messageId =
          id ??
          (await createMessage({
            conversation_id: conversationId,
            role: 'assistant',
            content,
            metadata: serializedMetadata,
            sequence_order,
          }))
        const newMessage: Message = {
          id: messageId,
          conversation_id: conversationId,
          role: 'assistant',
          content,
          metadata: serializedMetadata
            ? JSON.stringify(serializedMetadata)
            : null,
          sequence_order,
          created_at: Date.now(),
        }
        set((s) => ({
          messages: [...s.messages, newMessage],
          isStreaming: false,
          streamingContent: '',
          streamingMessageId: null,
          streamingGeneration: null,
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
          streamingGeneration: null,
        })
        return null
      }
    },
  })
)
