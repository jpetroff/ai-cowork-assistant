import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '@/lib/db/types'
import type { SealResult } from '@/lib/types'

const { messageApi, artifactApi, sidecarApi } = vi.hoisted(() => {
  const messages: Message[] = []

  return {
    messageApi: {
      conversationId: 'conv-1' as string | null,
      messages,
      loadForConversation: vi.fn(),
      addUserMessage: vi.fn(),
      beginStreaming: vi.fn(),
      appendChunk: vi.fn(),
      finalizeStreaming: vi.fn(),
      addSystemRevisionMessage: vi.fn(),
    },
    artifactApi: {
      loadForConversation: vi.fn(),
      createNewArtifact: vi.fn(),
      ensureDocumentThreadMessage: vi.fn(),
      sealForSend: vi.fn(),
      applyAiRevision: vi.fn(),
    },
    sidecarApi: {
      sendChatRequest: vi.fn(),
    },
  }
})

vi.mock('@/components/chat/messageStore', () => ({
  useMessageStore: {
    getState: () => messageApi,
  },
}))

vi.mock('@/components/editor/artifactStore', () => ({
  useArtifactStore: {
    getState: () => artifactApi,
  },
}))

vi.mock('@/components/chat/sidecarStore', () => ({
  useSidecarStore: {
    getState: () => sidecarApi,
  },
}))

import { useChatSessionStore } from '../chatSessionStore'

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    role: 'user',
    content: 'hello',
    metadata: null,
    sequence_order: 0,
    created_at: 1000,
    ...overrides,
  }
}

beforeEach(() => {
  useChatSessionStore.getState().reset()
  vi.clearAllMocks()
  messageApi.conversationId = 'conv-1'
  messageApi.messages.splice(0, messageApi.messages.length)
  messageApi.loadForConversation.mockResolvedValue(undefined)
  messageApi.addUserMessage.mockImplementation(async (content: string) => {
    messageApi.messages.push(
      makeMessage({
        id: 'user-1',
        role: 'user',
        content,
        sequence_order: messageApi.messages.length,
      })
    )
  })
  messageApi.finalizeStreaming.mockResolvedValue('assistant-1')
  messageApi.addSystemRevisionMessage.mockResolvedValue('sys-1')
  artifactApi.loadForConversation.mockResolvedValue(undefined)
  artifactApi.createNewArtifact.mockResolvedValue(undefined)
  artifactApi.ensureDocumentThreadMessage.mockResolvedValue(undefined)
  artifactApi.sealForSend.mockResolvedValue(null)
  artifactApi.applyAiRevision.mockResolvedValue(undefined)
  sidecarApi.sendChatRequest.mockResolvedValue({
    messageId: 'assistant-1',
    content: 'final',
    artifactContent: null,
  })
})

describe('useChatSessionStore', () => {
  it('loads message and artifact stores for the chat route context', async () => {
    await useChatSessionStore
      .getState()
      .loadChat({ projectId: 'proj-1', conversationId: 'conv-1' })

    expect(messageApi.loadForConversation).toHaveBeenCalledWith('conv-1')
    expect(artifactApi.loadForConversation).toHaveBeenCalledWith('conv-1')
    expect(artifactApi.ensureDocumentThreadMessage).toHaveBeenCalledWith(
      useChatSessionStore.getState().ensureRevisionMessage
    )
    expect(useChatSessionStore.getState().status).toBe('ready')
    expect(useChatSessionStore.getState().activeProjectId).toBe('proj-1')
  })

  it('creates a new document and anchors it in the thread', async () => {
    await useChatSessionStore.getState().createNewDocument('conv-1')

    expect(artifactApi.createNewArtifact).toHaveBeenCalledWith('conv-1')
    expect(artifactApi.ensureDocumentThreadMessage).toHaveBeenCalledWith(
      useChatSessionStore.getState().ensureRevisionMessage
    )
  })

  it('reuses an existing revision anchor message before creating a new one', async () => {
    messageApi.messages.push(
      makeMessage({
        id: 'sys-existing',
        role: 'system',
        metadata: JSON.stringify({
          artifactId: 'art-1',
          revisionId: 'rev-1',
          author: 'user',
        }),
      })
    )

    const id = await useChatSessionStore
      .getState()
      .ensureRevisionMessage('user', 'art-1', 'rev-1')

    expect(id).toBe('sys-existing')
    expect(messageApi.addSystemRevisionMessage).not.toHaveBeenCalled()
  })

  it('submits through message, artifact, sidecar, and AI revision stages', async () => {
    const sealResult: SealResult = {
      artifactId: 'art-1',
      revisionId: 'rev-1',
      content: 'artifact content',
    }
    artifactApi.sealForSend.mockResolvedValue(sealResult)
    sidecarApi.sendChatRequest.mockImplementation(
      async (_request, handlers) => {
        handlers.onChunk('chunk')
        return {
          messageId: 'assistant-1',
          content: 'final',
          artifactContent: 'updated artifact',
        }
      }
    )

    await useChatSessionStore.getState().submitMessage(' hello ')

    expect(messageApi.addUserMessage).toHaveBeenCalledWith('hello')
    expect(artifactApi.sealForSend).toHaveBeenCalledWith(
      useChatSessionStore.getState().ensureRevisionMessage
    )
    expect(sidecarApi.sendChatRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-1',
        artifact: {
          artifact_id: 'art-1',
          revision_id: 'rev-1',
          content: 'artifact content',
        },
      }),
      expect.any(Object)
    )
    expect(messageApi.beginStreaming).toHaveBeenCalled()
    expect(messageApi.appendChunk).toHaveBeenCalledWith('chunk')
    expect(messageApi.finalizeStreaming).toHaveBeenCalledWith(
      'assistant-1',
      'final'
    )
    expect(artifactApi.applyAiRevision).toHaveBeenCalledWith(
      'updated artifact',
      useChatSessionStore.getState().ensureRevisionMessage
    )
    expect(useChatSessionStore.getState().isAssistantStreaming).toBe(false)
  })
})
