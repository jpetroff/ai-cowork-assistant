import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LlmProvider, Message } from '@/lib/db/types'
import type { SealResult } from '@/lib/types'
import { useLlmProviderStore } from '@/components/projects/llmProviderStore'
import { useProjectSettingsStore } from '@/components/projects/projectSettingsStore'
import type { GenerationMetadata } from '../generationMetadata'

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
      previewAiRevisionDraft: vi.fn(),
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

function makeProvider(overrides: Partial<LlmProvider> = {}): LlmProvider {
  return {
    id: 'provider-1',
    name: 'Local Ollama',
    provider_type: 'ollama',
    base_url: 'http://localhost:11434',
    api_key: null,
    default_model: 'llama3',
    config_json: JSON.stringify({
      context_window: 8192,
      is_function_calling_model: true,
      thinking: true,
    }),
    is_default: 1,
    created_at: 1000,
    ...overrides,
  }
}

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

function makeGeneration(overrides: Partial<GenerationMetadata> = {}) {
  return {
    startedAt: 1000,
    completedAt: 1500,
    durationMs: 500,
    steps: [],
    ...overrides,
  }
}

function makeWorkflowMessage(
  overrides: {
    messageId?: string | null
    content?: string
    artifactContent?: string | null
    generation?: GenerationMetadata
  } = {}
) {
  return {
    messageId: Object.prototype.hasOwnProperty.call(overrides, 'messageId')
      ? (overrides.messageId ?? null)
      : 'assistant-1',
    content: overrides.content ?? 'final',
    artifactContent: overrides.artifactContent ?? null,
    generation: overrides.generation ?? makeGeneration(),
  }
}

type WorkflowMessage = ReturnType<typeof makeWorkflowMessage>

type StreamHandlers = {
  onChunk?: (chunk: string) => void
  onArtifactChunk?: (chunk: string) => void
  onMessageComplete?: (message: WorkflowMessage) => Promise<unknown>
}

function mockSidecarWorkflow(...messages: WorkflowMessage[]) {
  sidecarApi.sendChatRequest.mockImplementation(
    async (_request: unknown, handlers: StreamHandlers) => {
      for (const message of messages) {
        await handlers.onMessageComplete?.(message)
      }
      return { messages }
    }
  )
}

beforeEach(() => {
  useChatSessionStore.getState().reset()
  useLlmProviderStore.setState({
    providers: [makeProvider()],
    modelsByProvider: {},
    status: 'ready',
  })
  useProjectSettingsStore.setState({ aiConfigs: {} })
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
  artifactApi.previewAiRevisionDraft.mockReturnValue(undefined)
  artifactApi.applyAiRevision.mockResolvedValue(undefined)
  mockSidecarWorkflow(makeWorkflowMessage())
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
      async (_request: unknown, handlers: StreamHandlers) => {
        handlers.onChunk?.('chunk')
        handlers.onArtifactChunk?.('updated ')
        handlers.onArtifactChunk?.('artifact')
        const message = makeWorkflowMessage({
          artifactContent: 'updated artifact',
        })
        await handlers.onMessageComplete?.(message)
        return { messages: [message] }
      }
    )

    await useChatSessionStore.getState().submitMessage(' hello ')

    expect(messageApi.addUserMessage).toHaveBeenCalledWith('hello')
    expect(artifactApi.sealForSend).toHaveBeenCalledWith('user-1')
    expect(sidecarApi.sendChatRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'hello',
        chat_history: [],
        llm_provider: expect.objectContaining({
          provider_id: 'provider-1',
          provider_type: 'ollama',
          model: 'llama3',
          context_window: 8192,
          is_function_calling_model: true,
          thinking: true,
        }),
        artifact: {
          artifact_id: 'art-1',
          revision_id: 'rev-1',
          content: 'artifact content',
        },
      }),
      expect.any(Object)
    )
    expect(messageApi.beginStreaming).toHaveBeenCalledTimes(2)
    expect(messageApi.appendChunk).toHaveBeenCalledWith('chunk')
    expect(artifactApi.previewAiRevisionDraft).toHaveBeenNthCalledWith(
      1,
      'updated ',
      'art-1'
    )
    expect(artifactApi.previewAiRevisionDraft).toHaveBeenNthCalledWith(
      2,
      'updated artifact',
      'art-1'
    )
    expect(messageApi.finalizeStreaming).toHaveBeenNthCalledWith(
      1,
      'assistant-1',
      'final',
      { generation: expect.any(Object) }
    )
    expect(messageApi.finalizeStreaming).toHaveBeenNthCalledWith(2, null, '')
    expect(artifactApi.applyAiRevision).toHaveBeenCalledWith(
      'updated artifact',
      'assistant-1',
      'art-1'
    )
    expect(useChatSessionStore.getState().isAssistantStreaming).toBe(false)
  })

  it('persists multiple workflow messages before workflow streaming ends', async () => {
    const firstMessage = makeWorkflowMessage({
      messageId: null,
      content: 'first',
      artifactContent: 'first artifact',
      generation: makeGeneration({ startedAt: 2000 }),
    })
    const secondMessage = makeWorkflowMessage({
      messageId: null,
      content: 'second',
      artifactContent: 'second artifact',
      generation: makeGeneration({ startedAt: 3000 }),
    })
    messageApi.finalizeStreaming
      .mockResolvedValueOnce('assistant-1')
      .mockResolvedValueOnce('assistant-2')
      .mockResolvedValueOnce(null)
    sidecarApi.sendChatRequest.mockImplementation(
      async (_request: unknown, handlers: StreamHandlers) => {
        expect(useChatSessionStore.getState().isAssistantStreaming).toBe(true)
        await handlers.onMessageComplete?.(firstMessage)
        expect(useChatSessionStore.getState().isAssistantStreaming).toBe(true)
        await handlers.onMessageComplete?.(secondMessage)
        expect(useChatSessionStore.getState().isAssistantStreaming).toBe(true)
        return { messages: [firstMessage, secondMessage] }
      }
    )

    await useChatSessionStore.getState().submitMessage(' hello ')

    expect(messageApi.beginStreaming).toHaveBeenCalledTimes(3)
    expect(messageApi.finalizeStreaming).toHaveBeenNthCalledWith(
      1,
      null,
      'first',
      { generation: firstMessage.generation }
    )
    expect(messageApi.finalizeStreaming).toHaveBeenNthCalledWith(
      2,
      null,
      'second',
      { generation: secondMessage.generation }
    )
    expect(messageApi.finalizeStreaming).toHaveBeenNthCalledWith(3, null, '')
    expect(artifactApi.applyAiRevision).toHaveBeenNthCalledWith(
      1,
      'first artifact',
      'assistant-1',
      'active-art'
    )
    expect(artifactApi.applyAiRevision).toHaveBeenNthCalledWith(
      2,
      'second artifact',
      'assistant-2',
      'active-art'
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
    mockSidecarWorkflow(
      makeWorkflowMessage({
        artifactContent: 'generated from empty artifact',
      })
    )

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
    mockSidecarWorkflow(
      makeWorkflowMessage({
        artifactContent: 'new artifact content',
      })
    )

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
    mockSidecarWorkflow(
      makeWorkflowMessage({
        artifactContent: 'updated selected artifact',
      })
    )

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

  it('uses project AI config provider and model before the default provider', async () => {
    useChatSessionStore.setState({ activeProjectId: 'proj-1' })
    useLlmProviderStore.setState({
      providers: [
        makeProvider({
          id: 'default-provider',
          default_model: 'default-model',
        }),
        makeProvider({
          id: 'project-provider',
          name: 'Project OpenAI',
          provider_type: 'openai',
          base_url: 'https://api.openai.com/v1',
          api_key: 'sk-project',
          default_model: 'provider-default',
          config_json: JSON.stringify({ temperature: 0.2 }),
          is_default: 0,
        }),
      ],
      status: 'ready',
    })
    useProjectSettingsStore.setState({
      aiConfigs: {
        'proj-1': {
          provider_id: 'project-provider',
          model: 'project-model',
          embedding_model: null,
        },
      },
    })

    await useChatSessionStore.getState().submitMessage('hello')

    expect(sidecarApi.sendChatRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        llm_provider: expect.objectContaining({
          provider_id: 'project-provider',
          provider_type: 'openai',
          api_key: 'sk-project',
          model: 'project-model',
          temperature: 0.2,
        }),
      }),
      expect.any(Object)
    )
  })

  it('blocks send when no provider model can be resolved', async () => {
    useLlmProviderStore.setState({
      providers: [makeProvider({ default_model: null })],
      status: 'ready',
    })

    await useChatSessionStore.getState().submitMessage('hello')

    expect(sidecarApi.sendChatRequest).not.toHaveBeenCalled()
    expect(useChatSessionStore.getState().error).toMatch(/select a model/i)
  })
})
