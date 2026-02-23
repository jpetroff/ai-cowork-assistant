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
    this.connect(message, chatHistory)
  }

  private connect(message: string, chatHistory: ChatMessageBase[]): void {
    const url = this.getWebSocketUrl()

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        const request: ChatCompletionRequest = {
          message,
          chat_history: chatHistory,
        }
        this.ws?.send(JSON.stringify(request))
        this.getHandlers().onConnect()
      }

      this.ws.onmessage = (event) => {
        try {
          const response: DefaultResponse = JSON.parse(event.data)
          this.handleResponse(response)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        if (this.currentMessageId) {
          this.getHandlers().onError(this.currentMessageId, 'Connection error')
        }
      }

      this.ws.onclose = () => {
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
    return httpUrl.replace(/^http/, 'ws') + '/completion'
  }

  private handleResponse(response: DefaultResponse): void {
    if (!this.currentMessageId) return

    const messageId = this.currentMessageId
    const { type, payload, content } = response

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
        break
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
      }
    }

    if (this.streamState.isInArtifact) {
      const endIdx = content.indexOf(ARTIFACT_END)
      if (endIdx !== -1) {
        this.streamState.artifactContent += content.substring(0, endIdx)
        this.getHandlers().onArtifactContent(
          messageId,
          this.streamState.artifactContent
        )
        this.getHandlers().onArtifactEnd(messageId)
        this.streamState.isInArtifact = false
        this.streamState.artifactContent = ''
        const remaining = content.substring(endIdx + ARTIFACT_END.length)
        if (remaining) {
          this.getHandlers().onChunk(messageId, remaining)
        }
      } else {
        this.streamState.artifactContent += content
        this.getHandlers().onArtifactContent(messageId, content)
      }
    } else {
      const startIdx = content.indexOf(ARTIFACT_START)
      if (startIdx !== -1) {
        const before = content.substring(0, startIdx)
        if (before) {
          this.getHandlers().onChunk(messageId, before)
        }
        this.streamState.isInArtifact = true
        this.getHandlers().onArtifactStart(messageId)
        const after = content.substring(startIdx + ARTIFACT_START.length)
        if (after) {
          this.handleChunk(messageId, after)
        }
      } else {
        this.getHandlers().onChunk(messageId, content)
      }
    }
  }

  private handleComplete(messageId: string): void {
    this.getHandlers().onComplete(messageId)
    this.disconnect()
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
        useChatStore.getState().appendEventToMessage(messageId, event)
      },
      onThinking: (messageId, chunk) => {
        useChatStore.getState().appendToThinking(messageId, chunk)
      },
      onChunk: (messageId, chunk) => {
        useChatStore.getState().appendToMessage(messageId, chunk)
      },
      onArtifactStart: (messageId) => {
        useChatStore.getState().startArtifactStreaming(messageId)
      },
      onArtifactContent: (messageId, content) => {
        useChatStore.getState().appendStreamingChunk(content)
      },
      onArtifactEnd: (messageId) => {
        useChatStore.getState().finishArtifactStreaming(messageId)
      },
      onComplete: (messageId) => {
        useChatStore.getState().completeMessage(messageId)
      },
      onError: (messageId, error) => {
        useChatStore.getState().errorMessage(messageId, error)
      },
      onConnect: () => {
        useChatStore.getState().setConnectionStatus('connected')
      },
      onDisconnect: () => {
        useChatStore.getState().setConnectionStatus('disconnected')
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
