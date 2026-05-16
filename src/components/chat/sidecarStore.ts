import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import { console_if } from '@/lib/logger'

// ── Types ─────────────────────────────────────────────────────────────────────

/** @property conversation_id - conversation receiving the assistant response */
/** @property messages - non-system chat history sent to the sidecar */
/** @property artifact - optional artifact revision context attached to the request */
export interface ChatCompletionRequest {
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
  | {
      type: 'done'
      message_id: string
      content: string
      artifact_content?: string
    }
  | { type: 'error'; message: string }

/** @property messageId - assistant message ID returned by the sidecar, if any */
/** @property content - final assistant response text */
/** @property artifactContent - optional artifact content produced by the assistant */
export interface SidecarStreamResult {
  messageId: string | null
  content: string
  artifactContent: string | null
}

/** @property onChunk - called for each streamed assistant text chunk */
interface SidecarStreamHandlers {
  onChunk?: (chunk: string) => void
}

/** @property sidecarUrl - base URL for the local sidecar service */
/** @property isConnected - whether init found an available sidecar URL */
interface SidecarState {
  sidecarUrl: string | null
  isConnected: boolean
}

interface SidecarActions {
  init: () => Promise<void>
  sendChatRequest: (
    requestBody: ChatCompletionRequest,
    handlers?: SidecarStreamHandlers
  ) => Promise<SidecarStreamResult | null>
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useSidecarStore = create<SidecarState & SidecarActions>(
  (set, get) => ({
    sidecarUrl: null,
    isConnected: false,

    /**
     * Initializes the sidecar connection once at app startup. This store only tracks
     * transport availability; chat persistence is coordinated by chatSessionStore.
     */
    async init() {
      console_if('SIDECAR_STORE').log('[SIDECAR_STORE] init:start')
      try {
        const info = await invoke<{ available: boolean; url: string | null }>(
          'init'
        )
        if (info.available && info.url) {
          set({ sidecarUrl: info.url, isConnected: true })
          console_if('SIDECAR_STORE').log('[SIDECAR_STORE] init:ready', {
            url: info.url,
          })
        }
      } catch (err) {
        console.error('[SIDECAR_STORE] init:error', err)
      }
    },

    /**
     * Sends a prepared chat-completion request and streams chunks to the supplied
     * handlers. The final response is returned without mutating message/artifact state.
     */
    async sendChatRequest(requestBody, handlers = {}) {
      const { sidecarUrl } = get()
      if (!sidecarUrl) {
        console.warn('[SIDECAR_STORE] stream:skipped sidecar not connected')
        return null
      }

      console_if('SIDECAR_STORE').log('[SIDECAR_STORE] stream:start', {
        conversationId: requestBody.conversation_id,
        messageCount: requestBody.messages.length,
        artifactRevisionId: requestBody.artifact?.revision_id ?? null,
      })

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
              if (event.type === 'chunk') {
                finalContent += event.content
                handlers.onChunk?.(event.content)
              } else if (event.type === 'done') {
                finalContent = event.content
                finalMessageId = event.message_id
                finalArtifactContent = event.artifact_content ?? null
              } else if (event.type === 'error') {
                throw new Error(event.message)
              }
            } catch (err) {
              if (err instanceof Error && eventIsErrorData(data)) throw err
              // Ignore malformed SSE lines from partial transport frames.
            }
          }
        }

        console_if('SIDECAR_STORE').log('[SIDECAR_STORE] stream:done', {
          messageId: finalMessageId,
          hasArtifactContent: finalArtifactContent != null,
        })

        return {
          messageId: finalMessageId,
          content: finalContent,
          artifactContent: finalArtifactContent,
        }
      } catch (err) {
        console.error('[SIDECAR_STORE] stream:error', err)
        return null
      }
    },
  })
)

function eventIsErrorData(data: string) {
  try {
    return (JSON.parse(data) as SidecarEvent).type === 'error'
  } catch {
    return false
  }
}
