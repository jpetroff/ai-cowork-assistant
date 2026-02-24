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
import { generateChatName } from '@/lib/chat/auto-naming'
import { rename as renameChat, get as getChat } from '@/lib/chats'

const DEFAULT_NAME = 'Some LLM name'

export type ChatStore = {
  currentArtifactId: string | null
  currentChatId: string | null
  currentMessageId: string | null
  name: string
  artifactName: string
  markdown: string
  isStreaming: boolean
  isLoading: boolean
  loadedOnce: boolean
  lastSavedAt: number | undefined
  messages: ChatMessage[]
  inputText: string
  connectionStatus: ConnectionStatus
  artifactStreamingMessageId: string | null
  hasAutoNamed: boolean
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
  autoNameChat: () => Promise<void>
}

export const useChatStore = create<ChatStore>((set, get) => ({
  currentArtifactId: null,
  currentChatId: null,
  currentMessageId: null,
  name: DEFAULT_NAME,
  artifactName: DEFAULT_NAME,
  markdown: '',
  isStreaming: false,
  isLoading: false,
  loadedOnce: false,
  lastSavedAt: undefined,
  messages: [],
  inputText: '',
  connectionStatus: 'disconnected',
  artifactStreamingMessageId: null,
  hasAutoNamed: false,

  loadChat: async (chatId: string) => {
    set({ isLoading: true, currentChatId: chatId, hasAutoNamed: false })

    try {
      const [messages, chatRecord] = await Promise.all([
        loadChatMessages(chatId),
        getChat(chatId),
      ])
      const recentArtifact = await getMostRecentArtifactByChat(chatId)

      // Determine if chat has been auto-named already (has assistant messages)
      const hasAssistantMessage = messages.some((m) => m.role === 'assistant')
      // Check if chat has been manually renamed (name is not default)
      const chatName = chatRecord?.name || DEFAULT_NAME
      const isDefaultName = chatName === 'New Chat' || chatName === DEFAULT_NAME

      if (recentArtifact) {
        set({
          currentArtifactId: recentArtifact.id,
          currentMessageId: recentArtifact.message_id ?? null,
          name: chatName,
          artifactName: recentArtifact.name,
          markdown: recentArtifact.content ?? '',
          messages,
          lastSavedAt: recentArtifact.updated_at,
          isLoading: false,
          loadedOnce: true,
          hasAutoNamed: hasAssistantMessage && !isDefaultName,
        })
      } else {
        set({
          currentArtifactId: null,
          currentMessageId: null,
          name: chatName,
          artifactName: DEFAULT_NAME,
          markdown: '',
          messages,
          lastSavedAt: undefined,
          isLoading: false,
          loadedOnce: true,
          hasAutoNamed: hasAssistantMessage && !isDefaultName,
        })
      }
    } catch {
      set({
        currentArtifactId: null,
        currentMessageId: null,
        name: DEFAULT_NAME,
        artifactName: DEFAULT_NAME,
        markdown: '',
        messages: [],
        isLoading: false,
        loadedOnce: true,
        hasAutoNamed: false,
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
      artifactName,
      markdown,
    } = get()
    if (!currentArtifactId) return
    set({ isLoading: true })
    try {
      const input: UpsertArtifactInput = {
        id: currentArtifactId,
        name: artifactName,
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
    const { currentChatId, messages, hasAutoNamed } = get()

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

    // Auto-name chat on first assistant response
    if (!hasAutoNamed && currentChatId) {
      await get().autoNameChat()
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
        artifactName: `Document ${existingArtifacts + 1}`,
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

  autoNameChat: async () => {
    const { currentChatId, messages, name } = get()
    if (!currentChatId || get().hasAutoNamed) return

    // Only auto-name if using default name
    if (name !== 'New Chat' && name !== DEFAULT_NAME) {
      set({ hasAutoNamed: true })
      return
    }

    try {
      const generatedName = await generateChatName(messages)
      if (generatedName) {
        set({ name: generatedName, hasAutoNamed: true })
        // Persist to database
        await renameChat(currentChatId, generatedName)
        // Also save current artifact if exists
        await get().saveCurrent()
      }
    } catch (error) {
      console.error('[auto-naming] Failed to auto-name chat:', error)
      set({ hasAutoNamed: true })
    }
  },
}))
