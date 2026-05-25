import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import WebSocket, {
  type Message as WebSocketMessage,
} from '@tauri-apps/plugin-websocket'
import { console_if } from '@/lib/logger'
import type { ChatCompletionRequest as ApiChatCompletionRequest } from '@/lib/api-types'
import type { GenerationMetadata, GenerationStep } from './generationMetadata'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatCompletionRequest = ApiChatCompletionRequest

type SidecarEvent = {
  type:
    | 'completion.chunk'
    | 'completion.chunk.thinking'
    | 'chunk.completion.thinking'
    | 'completion.response'
    | 'error'
    | 'event'
    | string
  content?: string | number | null
  content_type?: string | null
  payload?: unknown
}

type SidecarContent = string | number | null | undefined

/** @property messageId - assistant message ID returned by the sidecar, if any */
/** @property content - final assistant response text */
/** @property artifactContent - optional artifact content produced by the assistant */
/** @property generation - captured generation step timeline */
export interface SidecarStreamResult {
  messageId: string | null
  content: string
  artifactContent: string | null
  generation: GenerationMetadata
}

/** @property onChunk - called for each streamed assistant text chunk */
/** @property onArtifactChunk - called for each streamed artifact chunk */
/** @property onStep - called when generation step metadata changes */
interface SidecarStreamHandlers {
  onChunk?: (chunk: string) => void
  onArtifactChunk?: (chunk: string) => void
  onStep?: (generation: GenerationMetadata) => void
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
        messageLength: requestBody.message.length,
        historyCount: requestBody.chat_history?.length ?? 0,
        artifactRevisionId: requestBody.artifact?.revision_id ?? null,
      })

      try {
        const websocketUrl = toWebSocketUrl(sidecarUrl, '/completion')
        const result = await streamCompletion(
          websocketUrl,
          requestBody,
          handlers
        )

        console_if('SIDECAR_STORE').log('[SIDECAR_STORE] stream:done', {
          messageId: result.messageId,
          hasArtifactContent: result.artifactContent != null,
        })

        return result
      } catch (err) {
        console.error('[SIDECAR_STORE] stream:error', err)
        return null
      }
    },
  })
)

function toWebSocketUrl(sidecarUrl: string, path: string) {
  const url = new URL(sidecarUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = path
  url.search = ''
  url.hash = ''
  return url.toString()
}

async function streamCompletion(
  websocketUrl: string,
  requestBody: ChatCompletionRequest,
  handlers: SidecarStreamHandlers
): Promise<SidecarStreamResult> {
  let socket: WebSocket | null = null
  let removeListener: () => void = () => undefined
  let messageContent = ''
  let artifactContent = ''
  let generation: GenerationMetadata = {
    startedAt: Date.now(),
    steps: [],
  }
  let activeStepId: string | null = null

  try {
    socket = await WebSocket.connect(websocketUrl)
    const activeSocket = socket

    return await new Promise<SidecarStreamResult>((resolve, reject) => {
      let settled = false

      const settle = (
        callback: (
          value: SidecarStreamResult | PromiseLike<SidecarStreamResult>
        ) => void,
        value: SidecarStreamResult
      ) => {
        if (settled) return
        settled = true
        removeListener()
        void activeSocket.disconnect().catch(() => undefined)
        callback(value)
      }

      const fail = (err: unknown) => {
        if (settled) return
        settled = true
        removeListener()
        void activeSocket.disconnect().catch(() => undefined)
        reject(err)
      }

      const emitGeneration = () => {
        handlers.onStep?.(cloneGenerationMetadata(generation))
      }

      const closeActiveStep = (endedAt: number) => {
        if (!activeStepId) return

        generation = {
          ...generation,
          steps: generation.steps.map((step) =>
            step.id === activeStepId
              ? {
                  ...step,
                  endedAt,
                  durationMs: Math.max(0, endedAt - step.startedAt),
                }
              : step
          ),
        }
        activeStepId = null
      }

      const startStep = (
        kind: GenerationStep['kind'],
        title: string,
        options: { content?: string; payload?: unknown } = {}
      ) => {
        const startedAt = Date.now()
        closeActiveStep(startedAt)
        const step: GenerationStep = {
          id: `step-${generation.steps.length + 1}`,
          kind,
          title,
          startedAt,
          ...options,
        }
        activeStepId = step.id
        generation = {
          ...generation,
          steps: [...generation.steps, step],
        }
        emitGeneration()
      }

      const appendThinking = (content: string) => {
        if (!content) return

        const activeStep = generation.steps.find(
          (step) => step.id === activeStepId
        )
        if (!activeStep || activeStep.kind !== 'thinking') {
          startStep('thinking', 'Thinking', { content })
          return
        }

        generation = {
          ...generation,
          steps: generation.steps.map((step) =>
            step.id === activeStepId
              ? { ...step, content: `${step.content ?? ''}${content}` }
              : step
          ),
        }
        emitGeneration()
      }

      removeListener = activeSocket.addListener((message) => {
        if (message.type === 'Close') {
          if (!settled) {
            fail(new Error('Sidecar websocket closed before completion'))
          }
          return
        }

        if (message.type !== 'Text') return

        try {
          const event = parseSidecarEvent(message)
          if (isThinkingEvent(event)) {
            appendThinking(stringifyContent(event.content))
            return
          }

          if (event.type === 'event') {
            startStep('event', getEventStepTitle(event.payload), {
              payload: sanitizeEventPayload(event.payload),
            })
            return
          }

          if (event.type === 'completion.chunk') {
            const chunk = stringifyContent(event.content)
            if (!chunk) return

            if (event.content_type) {
              artifactContent += chunk
              handlers.onArtifactChunk?.(chunk)
            } else {
              messageContent += chunk
              handlers.onChunk?.(chunk)
            }
            return
          }

          if (event.type === 'completion.response') {
            const completedAt = Date.now()
            closeActiveStep(completedAt)
            const finalContent = stringifyContent(event.content)
            if (finalContent) {
              messageContent += finalContent
              handlers.onChunk?.(finalContent)
            }
            settle(resolve, {
              messageId: null,
              content: messageContent.trim(),
              artifactContent: artifactContent.trimEnd() || null,
              generation: {
                ...generation,
                completedAt,
                durationMs: Math.max(0, completedAt - generation.startedAt),
              },
            })
            return
          }

          if (event.type === 'error') {
            fail(new Error(getSidecarErrorMessage(event)))
          }
        } catch (err) {
          fail(err)
        }
      })

      activeSocket.send(JSON.stringify(requestBody)).catch(fail)
    })
  } finally {
    removeListener()
    await socket?.disconnect().catch(() => undefined)
  }
}

function parseSidecarEvent(message: WebSocketMessage): SidecarEvent {
  if (message.type !== 'Text') {
    throw new Error(`Unsupported websocket message type: ${message.type}`)
  }

  return JSON.parse(message.data) as SidecarEvent
}

function stringifyContent(content: SidecarContent) {
  return content == null ? '' : String(content)
}

function isThinkingEvent(event: SidecarEvent) {
  return (
    event.type === 'completion.chunk.thinking' ||
    event.type === 'chunk.completion.thinking'
  )
}

function getEventStepTitle(payload: unknown) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (typeof record.msg === 'string' && record.msg.trim()) {
      return record.msg.trim()
    }
    if (typeof record.event_name === 'string' && record.event_name.trim()) {
      return record.event_name.trim()
    }
  }

  return 'Workflow event'
}

function sanitizeEventPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return payload.map(sanitizeEventPayload)
  }

  if (payload && typeof payload === 'object') {
    return Object.fromEntries(
      Object.entries(payload as Record<string, unknown>)
        .filter(([key]) => key !== 'artifact' && key !== 'artifact_text')
        .map(([key, value]) => [key, sanitizeEventPayload(value)])
    )
  }

  return payload
}

function cloneGenerationMetadata(
  generation: GenerationMetadata
): GenerationMetadata {
  return {
    ...generation,
    steps: generation.steps.map((step) => ({ ...step })),
  }
}

function getSidecarErrorMessage(event: SidecarEvent) {
  const payload = event.payload
  let payloadMessage: string | null = null

  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message
    if (typeof message === 'string') payloadMessage = message
  }

  return payloadMessage ?? (stringifyContent(event.content) || 'Sidecar error')
}
