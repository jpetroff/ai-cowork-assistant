import type {
  DefaultResponse,
  ChatCompletionRequest,
  ChatMessageBase,
} from '../api-types'
import type { WSEventHandlers, StreamState } from './types'
import { useChatStore } from '../../stores/chat-store'

const ARTIFACT_START = '|artifact|>'
const ARTIFACT_END = '<|artifact|'

export class ChatController {
  private ws: WebSocket | null = null
  private streamState: StreamState | null = null
  private currentMessageId: string | null = null
  private sidecarUrl: string

  constructor(sidecarUrl: string) {
    this.sidecarUrl = sidecarUrl
  }

  sendMessage(message: string, chatHistory: ChatMessageBase[]): void {
    console.log('[ChatController] sendMessage called, existing ws:', !!this.ws)
    // Close any existing connection before starting a new one
    if (this.ws) {
      console.log('[ChatController] Closing existing WebSocket')
      this.disconnect()
    }
    this.connect(message, chatHistory)
  }

  private connect(message: string, chatHistory: ChatMessageBase[]): void {
    const url = this.getWebSocketUrl()
    console.log('[ChatController] Connecting to WebSocket:', url)

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('[ChatController] WebSocket opened')
        const request: ChatCompletionRequest = {
          message,
          chat_history: chatHistory,
        }
        try {
          this.ws?.send(JSON.stringify(request))
          console.log('[ChatController] Request sent successfully')
        } catch (sendError) {
          console.error('[ChatController] Failed to send request:', sendError)
        }
        this.getHandlers().onConnect()
      }

      this.ws.onmessage = (event) => {
        try {
          const response: DefaultResponse = JSON.parse(event.data)
          console.log('[ChatController] Received message type:', response.type)
          this.handleResponse(response)
        } catch (error) {
          console.error(
            '[ChatController] Failed to parse WebSocket message:',
            error,
            'Raw data:',
            event.data
          )
        }
      }

      this.ws.onerror = (error) => {
        const wsUrl = this.ws?.url || 'unknown'
        const wsState = this.ws?.readyState
        const stateLabels = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']
        console.error('[ChatController] WebSocket error:', {
          url: wsUrl,
          readyState:
            wsState !== undefined
              ? `${wsState} (${stateLabels[wsState]})`
              : 'unknown',
          error: error,
          errorType: error?.type || 'unknown',
          currentMessageId: this.currentMessageId,
        })
        // Only report error if message is still streaming and hasn't completed
        if (this.currentMessageId && this.streamState) {
          // Check if we're still expecting completion
          const state = useChatStore.getState()
          const message = state.messages.find(
            (m) => m.id === this.currentMessageId
          )
          if (message && message.status === 'streaming') {
            this.getHandlers().onError(
              this.currentMessageId,
              'Connection error'
            )
          }
        }
      }

      this.ws.onclose = (event) => {
        console.log(
          '[ChatController] WebSocket closed:',
          event.code,
          event.reason
        )
        this.getHandlers().onDisconnect()
        this.cleanup()
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      if (this.currentMessageId) {
        this.getHandlers().onError(this.currentMessageId, 'Failed to connect')
      }
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.cleanup()
  }

  private getWebSocketUrl(): string {
    const httpUrl = this.sidecarUrl
    // Remove trailing slash if present, then convert http to ws and append path
    const cleanUrl = httpUrl.replace(/\/$/, '').replace(/^http/, 'ws')
    return `${cleanUrl}/completion`
  }

  private handleResponse(response: DefaultResponse): void {
    if (!this.currentMessageId) {
      console.log('[ChatController] No current message ID, skipping response')
      return
    }

    const messageId = this.currentMessageId
    const { type, payload, content } = response

    console.log(
      '[ChatController] Handling response type:',
      type,
      'for message:',
      messageId
    )

    try {
      switch (type) {
        case 'event':
          this.handleEvent(messageId, payload)
          break

        case 'completion.chunk.thinking':
          this.handleThinking(messageId, content)
          break

        case 'completion.chunk':
          this.handleChunk(messageId, content)
          break

        case 'completion.response':
          this.handleComplete(messageId)
          break

        case 'error':
          this.handleError(messageId, payload)
          break

        default:
          console.log('[ChatController] Unknown response type:', type)
          break
      }
    } catch (error) {
      console.error(
        '[ChatController] Error handling response type',
        type,
        ':',
        error
      )
    }
  }

  private handleEvent(messageId: string, payload: unknown): void {
    const eventMsg = this.parseEventPayload(payload)
    if (eventMsg) {
      this.getHandlers().onEvent(messageId, eventMsg)
    }
  }

  private handleThinking(
    messageId: string,
    content: string | number | null | undefined
  ): void {
    if (typeof content === 'string') {
      this.getHandlers().onThinking(messageId, content)
    }
  }

  private handleChunk(
    messageId: string,
    content: string | number | null | undefined
  ): void {
    if (typeof content !== 'string') return

    if (!this.streamState) {
      this.streamState = {
        messageId,
        isInArtifact: false,
        artifactContent: '',
        thinkingComplete: true,
        buffer: '',
      }
    }

    // Add new content to buffer (skip empty string which is used for re-processing)
    if (content !== '') {
      this.streamState.buffer += content
    }

    if (this.streamState.isInArtifact) {
      // Looking for end marker in artifact mode
      const endIdx = this.streamState.buffer.indexOf(ARTIFACT_END)
      if (endIdx !== -1) {
        // End marker found
        const artifactContent = this.streamState.buffer.substring(0, endIdx)
        const remaining = this.streamState.buffer.substring(
          endIdx + ARTIFACT_END.length
        )

        // Send final artifact content chunk
        if (artifactContent) {
          this.getHandlers().onArtifactContent(messageId, artifactContent)
        }

        // End artifact mode
        this.getHandlers().onArtifactEnd(messageId)
        this.streamState.isInArtifact = false
        this.streamState.buffer = remaining

        // Process remaining content (if any) recursively
        if (remaining) {
          this.handleChunk(messageId, '')
        }
      } else {
        // No end marker yet - stream content but keep enough buffered
        // to detect the end marker when it arrives
        const keepBuffered = ARTIFACT_END.length - 1
        if (this.streamState.buffer.length > keepBuffered) {
          const streamLength = this.streamState.buffer.length - keepBuffered
          const toStream = this.streamState.buffer.substring(0, streamLength)
          console.log(
            '[ChatController] Streaming artifact chunk, length:',
            toStream.length,
            'buffer remaining:',
            keepBuffered
          )
          this.getHandlers().onArtifactContent(messageId, toStream)
          this.streamState.buffer =
            this.streamState.buffer.substring(streamLength)
        }
      }
    } else {
      // Looking for start marker in chat mode
      const startIdx = this.streamState.buffer.indexOf(ARTIFACT_START)
      if (startIdx !== -1) {
        // Start marker found
        const beforeArtifact = this.streamState.buffer.substring(0, startIdx)
        const afterStart = this.streamState.buffer.substring(
          startIdx + ARTIFACT_START.length
        )

        // Send content before marker to chat
        if (beforeArtifact) {
          this.getHandlers().onChunk(messageId, beforeArtifact)
        }

        // Switch to artifact mode
        this.streamState.isInArtifact = true
        this.streamState.buffer = afterStart
        console.log(
          '[ChatController] Artifact started, initial buffer length:',
          afterStart.length
        )
        this.getHandlers().onArtifactStart(messageId)

        // Process content after start marker recursively
        if (afterStart) {
          this.handleChunk(messageId, '')
        }
      } else {
        // No start marker found - check if buffer could potentially contain it
        // Strategy: Only send content if we're CERTAIN it doesn't contain a marker.
        // If buffer ends with ANY prefix of the marker, keep the entire buffer.
        const markerLen = ARTIFACT_START.length
        let endsWithMarkerPrefix = false

        // Check if buffer ends with any prefix of the marker (1 to markerLen-1 chars)
        for (let prefixLen = 1; prefixLen < markerLen; prefixLen++) {
          if (this.streamState.buffer.length >= prefixLen) {
            const bufferSuffix = this.streamState.buffer.slice(-prefixLen)
            const markerPrefix = ARTIFACT_START.slice(0, prefixLen)
            if (bufferSuffix === markerPrefix) {
              endsWithMarkerPrefix = true
              break
            }
          }
        }

        if (endsWithMarkerPrefix) {
          // Buffer ends with a potential marker prefix
          // Only send content if we have substantial content before the prefix
          const minSafeContentLength = 20 // Arbitrary threshold
          if (
            this.streamState.buffer.length >
            markerLen + minSafeContentLength
          ) {
            // We have enough content to safely send most of it
            // Keep markerLen characters as they might form a complete marker
            const keepLength = markerLen
            const safeToSend = this.streamState.buffer.slice(0, -keepLength)
            if (safeToSend) {
              this.getHandlers().onChunk(messageId, safeToSend)
            }
            this.streamState.buffer = this.streamState.buffer.slice(-keepLength)
          }
          // Otherwise, keep the entire buffer and wait for more content
        } else {
          // Safe to send entire buffer - no marker prefix detected
          this.getHandlers().onChunk(messageId, this.streamState.buffer)
          this.streamState.buffer = ''
        }
      }
    }
  }

  private handleComplete(messageId: string): void {
    console.log(
      '[ChatController] handleComplete called for message:',
      messageId
    )
    try {
      // Flush any remaining buffer content
      if (this.streamState && this.streamState.buffer) {
        console.log(
          '[ChatController] Flushing buffer, isInArtifact:',
          this.streamState.isInArtifact,
          'buffer length:',
          this.streamState.buffer.length
        )
        if (this.streamState.isInArtifact) {
          this.getHandlers().onArtifactContent(
            messageId,
            this.streamState.buffer
          )
          this.getHandlers().onArtifactEnd(messageId)
        } else {
          this.getHandlers().onChunk(messageId, this.streamState.buffer)
        }
      }
      console.log('[ChatController] Calling onComplete')
      this.getHandlers().onComplete(messageId)
      console.log('[ChatController] Disconnecting WebSocket')
      this.disconnect()
    } catch (error) {
      console.error('[ChatController] Error in handleComplete:', error)
      this.disconnect()
    }
  }

  private handleError(messageId: string, payload: unknown): void {
    const errorMsg = typeof payload === 'string' ? payload : 'An error occurred'
    this.getHandlers().onError(messageId, errorMsg)
    this.disconnect()
  }

  private parseEventPayload(payload: unknown): string | null {
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload)
        return parsed.msg || null
      } catch {
        return payload
      }
    }
    if (typeof payload === 'object' && payload !== null && 'msg' in payload) {
      return String((payload as { msg: unknown }).msg)
    }
    return null
  }

  private getHandlers(): WSEventHandlers {
    return {
      onEvent: (messageId, event) => {
        try {
          useChatStore.getState().appendEventToMessage(messageId, event)
        } catch (e) {
          console.error('[ChatController] Error in onEvent:', e)
        }
      },
      onThinking: (messageId, chunk) => {
        try {
          useChatStore.getState().appendToThinking(messageId, chunk)
        } catch (e) {
          console.error('[ChatController] Error in onThinking:', e)
        }
      },
      onChunk: (messageId, chunk) => {
        try {
          useChatStore.getState().appendToMessage(messageId, chunk)
        } catch (e) {
          console.error('[ChatController] Error in onChunk:', e)
        }
      },
      onArtifactStart: (messageId) => {
        try {
          useChatStore.getState().startArtifactStreaming(messageId)
        } catch (e) {
          console.error('[ChatController] Error in onArtifactStart:', e)
        }
      },
      onArtifactContent: (messageId, content) => {
        try {
          useChatStore.getState().appendStreamingChunk(content)
        } catch (e) {
          console.error('[ChatController] Error in onArtifactContent:', e)
        }
      },
      onArtifactEnd: (messageId) => {
        try {
          useChatStore.getState().finishArtifactStreaming(messageId)
        } catch (e) {
          console.error('[ChatController] Error in onArtifactEnd:', e)
        }
      },
      onComplete: (messageId) => {
        try {
          useChatStore.getState().completeMessage(messageId)
        } catch (e) {
          console.error('[ChatController] Error in onComplete:', e)
        }
      },
      onError: (messageId, error) => {
        try {
          useChatStore.getState().errorMessage(messageId, error)
        } catch (e) {
          console.error('[ChatController] Error in onError:', e)
        }
      },
      onConnect: () => {
        try {
          useChatStore.getState().setConnectionStatus('connected')
        } catch (e) {
          console.error('[ChatController] Error in onConnect:', e)
        }
      },
      onDisconnect: () => {
        try {
          useChatStore.getState().setConnectionStatus('disconnected')
        } catch (e) {
          console.error('[ChatController] Error in onDisconnect:', e)
        }
      },
    }
  }

  setCurrentMessageId(id: string): void {
    this.currentMessageId = id
  }

  private cleanup(): void {
    this.streamState = null
    this.currentMessageId = null
  }
}

let chatControllerInstance: ChatController | null = null

export function getChatController(sidecarUrl: string): ChatController {
  if (!chatControllerInstance) {
    chatControllerInstance = new ChatController(sidecarUrl)
  }
  return chatControllerInstance
}

export function resetChatController(): void {
  if (chatControllerInstance) {
    chatControllerInstance.disconnect()
    chatControllerInstance = null
  }
}
