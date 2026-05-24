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
    },
    artifactApi: {
      artifact: { id: 'active-art' } as { id: string } | null,
      loadForConversation: vi.fn(),
      createNewArtifact: vi.fn(),
      requestArtifactLoad: vi.fn(),
      sealForSend: vi.fn(),
      getArtifactContextForSend: vi.fn(),
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
    const id = 'user-1'
    messageApi.messages.push(
      makeMessage({
        id,
        role: 'user',
        content,
        sequence_order: messageApi.messages.length,
      })
    )
    return id
  })
  messageApi.finalizeStreaming.mockResolvedValue('assistant-1')
  artifactApi.loadForConversation.mockResolvedValue(undefined)
  artifactApi.createNewArtifact.mockResolvedValue('new-art')
  artifactApi.requestArtifactLoad.mockResolvedValue(undefined)
  artifactApi.artifact = { id: 'active-art' }
  artifactApi.sealForSend.mockResolvedValue(null)
  artifactApi.getArtifactContextForSend.mockResolvedValue(null)
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
    expect(useChatSessionStore.getState().status).toBe('ready')
    expect(useChatSessionStore.getState().activeProjectId).toBe('proj-1')
  })

  it('creates a new document', async () => {
    await useChatSessionStore.getState().createNewDocument('conv-1')

    expect(artifactApi.createNewArtifact).toHaveBeenCalledWith('conv-1')
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
    expect(artifactApi.sealForSend).toHaveBeenCalledWith('user-1')
    expect(sidecarApi.sendChatRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'hello',
        chat_history: [],
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
      'assistant-1',
      'art-1'
    )
    expect(useChatSessionStore.getState().isAssistantStreaming).toBe(false)
  })

  it('submits without artifact context when explicitly removed', async () => {
    await useChatSessionStore.getState().submitMessage(' hello ', null)

    const requestBody = sidecarApi.sendChatRequest.mock.calls[0][0]
    expect(artifactApi.sealForSend).not.toHaveBeenCalled()
    expect(artifactApi.getArtifactContextForSend).not.toHaveBeenCalled()
    expect(artifactApi.createNewArtifact).toHaveBeenCalledWith('conv-1')
    expect(requestBody.artifact).toBeNull()
  })

  it('submits an attached empty artifact with empty content', async () => {
    const sealResult: SealResult = {
      artifactId: 'active-art',
      revisionId: null,
      content: '',
    }
    artifactApi.sealForSend.mockResolvedValue(sealResult)
    sidecarApi.sendChatRequest.mockResolvedValue({
      messageId: 'assistant-1',
      content: 'final',
      artifactContent: 'generated from empty artifact',
    })

    await useChatSessionStore.getState().submitMessage(' fill it ')

    expect(sidecarApi.sendChatRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: {
          artifact_id: 'active-art',
          revision_id: null,
          content: '',
        },
      }),
      expect.any(Object)
    )
    expect(artifactApi.applyAiRevision).toHaveBeenCalledWith(
      'generated from empty artifact',
      'assistant-1',
      'active-art'
    )
  })

  it('creates and targets a new artifact when no artifact is attached', async () => {
    sidecarApi.sendChatRequest.mockResolvedValue({
      messageId: 'assistant-1',
      content: 'final',
      artifactContent: 'new artifact content',
    })

    await useChatSessionStore.getState().submitMessage(' new doc ', null)

    expect(artifactApi.createNewArtifact).toHaveBeenCalledWith('conv-1')
    expect(sidecarApi.sendChatRequest).toHaveBeenCalledWith(
      expect.objectContaining({ artifact: null }),
      expect.any(Object)
    )
    expect(artifactApi.applyAiRevision).toHaveBeenCalledWith(
      'new artifact content',
      'assistant-1',
      'new-art'
    )
  })

  it('submits an explicit non-active artifact context', async () => {
    const sealResult: SealResult = {
      artifactId: 'art-2',
      revisionId: 'rev-2',
      content: 'selected artifact content',
    }
    artifactApi.getArtifactContextForSend.mockResolvedValue(sealResult)
    sidecarApi.sendChatRequest.mockResolvedValue({
      messageId: 'assistant-1',
      content: 'final',
      artifactContent: 'updated selected artifact',
    })

    await useChatSessionStore
      .getState()
      .submitMessage(' hello ', { artifactId: 'art-2' })

    expect(artifactApi.sealForSend).not.toHaveBeenCalled()
    expect(artifactApi.getArtifactContextForSend).toHaveBeenCalledWith(
      'art-2',
      'user-1'
    )
    expect(artifactApi.requestArtifactLoad).toHaveBeenCalledWith('art-2')
    expect(sidecarApi.sendChatRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: {
          artifact_id: 'art-2',
          revision_id: 'rev-2',
          content: 'selected artifact content',
        },
      }),
      expect.any(Object)
    )
    expect(artifactApi.applyAiRevision).toHaveBeenCalledWith(
      'updated selected artifact',
      'assistant-1',
      'art-2'
    )
  })
})
