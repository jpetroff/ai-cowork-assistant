import { create } from 'zustand'
import {
  loadArtifactById,
  upsertArtifact,
  getMostRecentArtifactByChat,
  type UpsertArtifactInput,
} from '@/lib/artifacts'
import { closeOpenMarkdownDelimiters } from '@/lib/markdown-streaming'
import type { ConnectionStatus, ChatMessage } from '@/lib/chat/types'
import { generateId, buildChatHistory } from '@/lib/chat/types'
import { getChatController } from '@/lib/chat/chat-controller'
import { useConfigStore } from './config-store'
import type { ChatMessageBase } from '@/lib/api-types'
import { loadChatMessages, saveMessage } from '@/lib/chat/message-persistence'

const DEFAULT_NAME = 'Untitled project'

export type ChatStore = {
  currentArtifactId: string | null
  currentChatId: string | null
  currentMessageId: string | null
  name: string
  markdown: string
  isStreaming: boolean
  isLoading: boolean
  loadedOnce: boolean
  lastSavedAt: number | undefined
  messages: ChatMessage[]
  inputText: string
  connectionStatus: ConnectionStatus
  artifactStreamingMessageId: string | null
  loadChat: (chatId: string) => Promise<void>
  setMarkdown: (next: string) => void
  setName: (name: string) => void
  saveCurrent: () => Promise<void>
  startStreaming: (base: string) => void
  appendStreamingChunk: (chunk: string) => void
  finishStreaming: () => void
  setInputText: (text: string) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  sendMessage: (text: string) => Promise<void>
  appendToMessage: (messageId: string, chunk: string) => void
  appendToThinking: (messageId: string, chunk: string) => void
  appendEventToMessage: (messageId: string, event: string) => void
  completeMessage: (messageId: string) => Promise<void>
  errorMessage: (messageId: string, error: string) => void
  startArtifactStreaming: (messageId: string) => void
  finishArtifactStreaming: (messageId: string) => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  currentArtifactId: null,
  currentChatId: null,
  currentMessageId: null,
  name: DEFAULT_NAME,
  markdown: '',
  isStreaming: false,
  isLoading: false,
  loadedOnce: false,
  lastSavedAt: undefined,
  messages: [],
  inputText: '',
  connectionStatus: 'disconnected',
  artifactStreamingMessageId: null,

  loadChat: async (chatId: string) => {
    set({ isLoading: true, currentChatId: chatId })

    try {
      const messages = await loadChatMessages(chatId)
      const recentArtifact = await getMostRecentArtifactByChat(chatId)

      if (recentArtifact) {
        set({
          currentArtifactId: recentArtifact.id,
          currentMessageId: recentArtifact.message_id ?? null,
          name: recentArtifact.name,
          markdown: recentArtifact.content ?? '',
          messages,
          lastSavedAt: recentArtifact.updated_at,
          isLoading: false,
          loadedOnce: true,
        })
      } else {
        set({
          currentArtifactId: null,
          currentMessageId: null,
          name: DEFAULT_NAME,
          markdown: '',
          messages,
          lastSavedAt: undefined,
          isLoading: false,
          loadedOnce: true,
        })
      }
    } catch {
      set({
        currentArtifactId: null,
        currentMessageId: null,
        name: DEFAULT_NAME,
        markdown: '',
        messages: [],
        isLoading: false,
        loadedOnce: true,
      })
    }
  },

  setMarkdown: (next: string) => {
    if (get().isStreaming) return
    set({ markdown: next })
  },

  setName: (name: string) => {
    set({ name })
  },

  saveCurrent: async () => {
    const {
      currentArtifactId,
      currentChatId,
      currentMessageId,
      name,
      markdown,
    } = get()
    if (!currentArtifactId) return
    set({ isLoading: true })
    try {
      const input: UpsertArtifactInput = {
        id: currentArtifactId,
        name,
        file_type: 'markdown',
        content: markdown,
        chat_id: currentChatId ?? undefined,
        message_id: currentMessageId ?? undefined,
      }
      await upsertArtifact(input)
      set({ lastSavedAt: Date.now(), isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  startStreaming: (base: string) => {
    set({ isStreaming: true, markdown: base })
  },

  appendStreamingChunk: (chunk: string) => {
    set((state) => {
      if (!state.isStreaming) return state
      const nextRaw = state.markdown + chunk
      const next = closeOpenMarkdownDelimiters(nextRaw)
      return { markdown: next }
    })
  },

  finishStreaming: () => {
    set({ isStreaming: false })
  },

  setInputText: (text: string) => {
    set({ inputText: text })
  },

  setConnectionStatus: (status: ConnectionStatus) => {
    set({ connectionStatus: status })
  },

  sendMessage: async (text: string) => {
    const { currentChatId, messages } = get()
    if (!currentChatId) return

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
      status: 'complete',
    }

    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      status: 'streaming',
      thinking: '',
      events: [],
    }

    set({
      messages: [...messages, userMsg, assistantMsg],
      inputText: '',
    })

    // Persist user message to database
    await saveMessage(userMsg, currentChatId)

    const sidecarUrl = useConfigStore.getState().sidecarUrl
    if (!sidecarUrl) {
      get().errorMessage(assistantMsg.id, 'No sidecar URL configured')
      return
    }

    const controller = getChatController(sidecarUrl)
    controller.setCurrentMessageId(assistantMsg.id)

    const chatHistory: ChatMessageBase[] = buildChatHistory([
      ...messages,
      userMsg,
    ])
    controller.sendMessage(text, chatHistory)
  },

  appendToMessage: (messageId: string, chunk: string) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + chunk } : m
      ),
    }))
  },

  appendToThinking: (messageId: string, chunk: string) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, thinking: (m.thinking || '') + chunk } : m
      ),
    }))
  },

  appendEventToMessage: (messageId: string, event: string) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, events: [event] } : m
      ),
    }))
  },

  completeMessage: async (messageId: string) => {
    const { currentChatId, messages } = get()

    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, status: 'complete', events: [] } : m
      ),
    }))

    // Persist assistant message to database
    const assistantMsg = messages.find((m) => m.id === messageId)
    if (assistantMsg && currentChatId) {
      await saveMessage({ ...assistantMsg, status: 'complete' }, currentChatId)
    }
  },

  errorMessage: (messageId: string, error: string) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, status: 'error', content: error } : m
      ),
    }))
  },

  startArtifactStreaming: (messageId: string) => {
    const state = get()
    const message = state.messages.find((m) => m.id === messageId)
    if (!message) return

    if (state.artifactStreamingMessageId === messageId) return

    const newArtifactId = generateId()
    const existingArtifacts = state.messages.filter((m) => m.hasArtifact).length

    if (existingArtifacts === 0) {
      set({
        currentArtifactId: newArtifactId,
        markdown: '',
        isStreaming: true,
        artifactStreamingMessageId: messageId,
      })
    } else {
      set({
        currentArtifactId: newArtifactId,
        name: `Document ${existingArtifacts + 1}`,
        markdown: '',
        isStreaming: true,
        artifactStreamingMessageId: messageId,
      })
    }

    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, hasArtifact: true } : m
      ),
    }))
  },

  finishArtifactStreaming: (messageId: string) => {
    const state = get()

    if (state.artifactStreamingMessageId !== messageId) return

    set({ isStreaming: false, artifactStreamingMessageId: null })
    get().saveCurrent()
  },
}))
