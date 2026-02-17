import { create } from 'zustand'
import {
  loadArtifactById,
  upsertArtifact,
  getMostRecentArtifact,
  getMostRecentArtifactByChat,
  type UpsertArtifactInput,
} from '@/lib/artifacts'
import { closeOpenMarkdownDelimiters } from '@/lib/markdown-streaming'
import { loadConfiguration, saveConfigurationEntry } from '@/lib/db'

const DEFAULT_ARTIFACT_ID = 'default-project'
const DEFAULT_NAME = 'Untitled project'
const LAST_OPENED_KEY = 'last_opened_artifact_id'
const LAST_CHAT_KEY = 'last_opened_chat_id'
const LAST_MESSAGE_KEY = 'last_opened_message_id'

// Mock chat and message IDs since chat is not fully implemented yet
const MOCK_CHAT_ID = '550e8400-e29b-41d4-a716-446655440000'
const MOCK_MESSAGE_ID = '550e8400-e29b-41d4-a716-446655440001'

export type ProjectStore = {
  currentArtifactId: string | null
  currentChatId: string | null
  currentMessageId: string | null
  name: string
  markdown: string
  isStreaming: boolean
  isLoading: boolean
  loadedOnce: boolean
  lastSavedAt: number | undefined
  loadArtifact: (id?: string) => Promise<void>
  setMarkdown: (next: string) => void
  setName: (name: string) => void
  saveCurrent: () => Promise<void>
  startStreaming: (base: string) => void
  appendStreamingChunk: (chunk: string) => void
  finishStreaming: () => void
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  currentArtifactId: DEFAULT_ARTIFACT_ID,
  currentChatId: MOCK_CHAT_ID,
  currentMessageId: MOCK_MESSAGE_ID,
  name: DEFAULT_NAME,
  markdown: '',
  isStreaming: false,
  isLoading: false,
  loadedOnce: false,
  lastSavedAt: undefined,

  loadArtifact: async (id?: string) => {
    let artifactId = id
    let chatId = get().currentChatId
    let messageId = get().currentMessageId

    if (!artifactId) {
      // Try to load last opened artifact, chat, and message from config
      try {
        const config = await loadConfiguration()
        artifactId = config[LAST_OPENED_KEY] || undefined
        const savedChatId = config[LAST_CHAT_KEY]
        const savedMessageId = config[LAST_MESSAGE_KEY]
        if (savedChatId) chatId = savedChatId
        if (savedMessageId) messageId = savedMessageId
      } catch {
        // Ignore config errors
      }

      // If no specific artifact, try to get most recent for the current chat
      if (!artifactId && chatId) {
        try {
          const recent = await getMostRecentArtifactByChat(chatId)
          if (recent) {
            artifactId = recent.id
            // Restore chat/message from the saved artifact if available
            if (recent.chat_id) chatId = recent.chat_id
            if (recent.message_id) messageId = recent.message_id
          }
        } catch {
          // Ignore errors
        }
      }

      // If still no artifact, try most recent overall
      if (!artifactId) {
        try {
          const recent = await getMostRecentArtifact()
          if (recent) {
            artifactId = recent.id
            // Restore chat/message from the saved artifact if available
            if (recent.chat_id) chatId = recent.chat_id
            if (recent.message_id) messageId = recent.message_id
          }
        } catch {
          // Ignore errors
        }
      }

      // Fall back to default
      artifactId = artifactId || DEFAULT_ARTIFACT_ID
    }

    set({ isLoading: true })
    try {
      const record = await loadArtifactById(artifactId)
      if (record) {
        set({
          currentArtifactId: record.id,
          currentChatId: chatId,
          currentMessageId: messageId,
          name: record.name,
          markdown: record.content ?? '',
          lastSavedAt: record.updated_at,
          isLoading: false,
          loadedOnce: true,
        })
        // Save as last opened
        try {
          await saveConfigurationEntry(LAST_OPENED_KEY, record.id)
          if (chatId) await saveConfigurationEntry(LAST_CHAT_KEY, chatId)
          if (messageId)
            await saveConfigurationEntry(LAST_MESSAGE_KEY, messageId)
        } catch {
          // Ignore config save errors
        }
      } else {
        set({
          currentArtifactId: artifactId,
          currentChatId: chatId,
          currentMessageId: messageId,
          name: DEFAULT_NAME,
          markdown: '',
          isLoading: false,
          loadedOnce: true,
        })
      }
    } catch {
      set({
        currentArtifactId: artifactId,
        currentChatId: chatId,
        currentMessageId: messageId,
        name: DEFAULT_NAME,
        markdown: '',
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
      // Save as last opened
      try {
        await saveConfigurationEntry(LAST_OPENED_KEY, currentArtifactId)
        if (currentChatId)
          await saveConfigurationEntry(LAST_CHAT_KEY, currentChatId)
        if (currentMessageId)
          await saveConfigurationEntry(LAST_MESSAGE_KEY, currentMessageId)
      } catch {
        // Ignore config save errors
      }
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
}))
