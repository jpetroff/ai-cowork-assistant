import type { ChatMessageBase } from '../api-types'

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export type MessageStatus = 'sending' | 'streaming' | 'complete' | 'error'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  status?: MessageStatus
  thinking?: string
  events?: string[]
  hasArtifact?: boolean
}

export interface StreamState {
  messageId: string
  isInArtifact: boolean
  artifactContent: string
  thinkingComplete: boolean
}

export interface WSEventHandlers {
  onEvent: (messageId: string, event: string) => void
  onThinking: (messageId: string, chunk: string) => void
  onChunk: (messageId: string, chunk: string) => void
  onArtifactStart: (messageId: string) => void
  onArtifactContent: (messageId: string, content: string) => void
  onArtifactEnd: (messageId: string) => void
  onComplete: (messageId: string) => void
  onError: (messageId: string, error: string) => void
  onConnect: () => void
  onDisconnect: () => void
}

export function buildChatHistory(messages: ChatMessage[]): ChatMessageBase[] {
  return messages
    .filter((m) => m.status === 'complete')
    .map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }))
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}
