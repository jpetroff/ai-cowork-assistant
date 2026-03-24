import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { useMessageStore } from './messageStore'
import { useArtifactStore } from './artifactStore'
import { createMessage } from '@/lib/db/repositories/messages'
import type { SealResult } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatCompletionRequest {
  conversation_id: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  artifact?: {
    artifact_id: string
    revision_id: string
    content: string
  }
}

type SidecarEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; message_id: string; content: string; artifact_content?: string }
  | { type: 'error'; message: string }

interface SidecarState {
  sidecarUrl: string | null
  isConnected: boolean
}

interface SidecarActions {
  /**
   * Initialise the sidecar connection. Called once on app startup.
   */
  init: () => Promise<void>
  /**
   * Send a chat request to the sidecar.
   * @param userMessage - The user's message text (already saved to DB by caller)
   * @param sealResult  - The sealed artifact revision, or null if no artifact
   */
  sendChatRequest: (userMessage: string, sealResult: SealResult | null) => Promise<void>
  /** @internal Dispatch a single SSE event to the message store. */
  _dispatch: (event: SidecarEvent) => Promise<void>
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSidecarStore = create<SidecarState & SidecarActions>((set, get) => ({
  sidecarUrl: null,
  isConnected: false,

  async init() {
    try {
      const info = await invoke<{ available: boolean; url: string | null }>('init')
      if (info.available && info.url) {
        set({ sidecarUrl: info.url, isConnected: true })
      }
    } catch (err) {
      console.error('[sidecarStore] init error:', err)
    }
  },

  async sendChatRequest(userMessage, sealResult) {
    const { sidecarUrl } = get()
    if (!sidecarUrl) {
      console.warn('[sidecarStore] sidecar not connected')
      return
    }

    const messageStore = useMessageStore.getState()
    const conversationId = messageStore.conversationId
    if (!conversationId) return

    const allMessages = messageStore.messages
    const historyMessages = allMessages.map((m) => ({ role: m.role, content: m.content }))

    const requestBody: ChatCompletionRequest = {
      conversation_id: conversationId,
      messages: historyMessages,
      ...(sealResult
        ? {
            artifact: {
              artifact_id: sealResult.artifactId,
              revision_id: sealResult.revisionId,
              content: sealResult.content,
            },
          }
        : {}),
    }

    messageStore.beginStreaming()

    try {
      const response = await fetch(`${sidecarUrl}/chat/completions/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalContent = ''
      let finalMessageId: string | null = null
      let finalArtifactContent: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue

          try {
            const event: SidecarEvent = JSON.parse(data)
            await get()._dispatch(event)
            if (event.type === 'chunk') {
              finalContent += event.content
            } else if (event.type === 'done') {
              finalContent = event.content
              finalMessageId = event.message_id
              finalArtifactContent = event.artifact_content ?? null
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }

      // Persist the final assistant message if we didn't get a done event with an ID
      if (!finalMessageId && finalContent) {
        const sequence_order = messageStore.messages.length
        finalMessageId = await createMessage({
          conversation_id: conversationId,
          role: 'assistant',
          content: finalContent,
          sequence_order,
        })
      }

      if (finalMessageId) {
        messageStore.finalizeStreaming(finalMessageId, finalContent)

        // Apply AI revision if the sidecar returned updated document content
        if (finalArtifactContent !== null) {
          await useArtifactStore.getState().applyAiRevision(finalArtifactContent, finalMessageId)
        }
      }
    } catch (err) {
      console.error('[sidecarStore] sendChatRequest error:', err)
      messageStore.finalizeStreaming('', '')
    }
  },

  /**
   * Dispatch a single SSE event, updating the message store streaming state.
   * @internal
   */
  async _dispatch(event: SidecarEvent) {
    const messageStore = useMessageStore.getState()
    if (event.type === 'chunk') {
      messageStore.appendChunk(event.content)
    }
    // 'done' and 'error' are handled in the caller after the stream closes
  },
}))
