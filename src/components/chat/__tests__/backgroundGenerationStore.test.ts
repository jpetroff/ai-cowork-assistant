import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationStore } from '@/components/ui/notificationStore'
import type { Artifact, ArtifactRevision, Message } from '@/lib/db/types'
import { setCurrentRoutePathname } from '@/lib/routePresence'
import type { GenerationMetadata, MessageMetadata } from '../generationMetadata'

const {
  artifactApi,
  artifacts,
  conversations,
  messageStoreApi,
  messages,
  revisions,
  sidecarApi,
} = vi.hoisted(() => {
  const messages: Message[] = []
  const revisions: ArtifactRevision[] = []
  const artifacts: Artifact[] = [
    {
      id: 'active-art',
      conversation_id: 'conv-1',
      title: null,
      current_revision_id: null,
      file_path: null,
      file_hash: null,
      created_at: 1000,
      updated_at: 1000,
    },
    {
      id: 'art-2',
      conversation_id: 'conv-2',
      title: null,
      current_revision_id: null,
      file_path: null,
      file_hash: null,
      created_at: 1000,
      updated_at: 1000,
    },
  ]
  const conversations = [
    {
      id: 'conv-1',
      project_id: 'proj-1',
      title: null,
      active_artifact_id: 'active-art',
      created_at: 1000,
      updated_at: 1000,
    },
    {
      id: 'conv-2',
      project_id: 'proj-1',
      title: null,
      active_artifact_id: 'art-2',
      created_at: 1000,
      updated_at: 1000,
    },
  ]

  return {
    artifactApi: {
      artifact: { id: 'active-art' },
      sealForSend: vi.fn(),
      getArtifactContextForSend: vi.fn(),
      requestArtifactLoad: vi.fn(),
      createNewArtifact: vi.fn(),
      upsertStreamingAiRevision: vi.fn(),
    },
    artifacts,
    conversations,
    messageStoreApi: {
      upsertMessage: vi.fn(),
      patchMessage: vi.fn(),
    },
    messages,
    revisions,
    sidecarApi: {
      sendChatRequest: vi.fn(),
    },
  }
})

vi.mock('../llmProviderSettings', () => ({
  resolveLlmProviderSettings: () => ({
    provider_id: 'provider-1',
    provider_type: 'ollama',
    name: 'Ollama',
    base_url: 'http://localhost:11434',
    api_key: null,
    model: 'llama3',
    config: {},
  }),
}))

vi.mock('@/components/editor/artifactStore', () => ({
  useArtifactStore: {
    getState: () => artifactApi,
  },
}))

vi.mock('@/components/chat/messageStore', () => ({
  useMessageStore: {
    getState: () => messageStoreApi,
  },
}))

vi.mock('@/components/chat/sidecarStore', () => ({
  useSidecarStore: {
    getState: () => sidecarApi,
  },
}))

vi.mock('@/lib/db/repositories/conversations', () => ({
  getConversation: async (id: string) =>
    conversations.find((conversation) => conversation.id === id) ?? null,
  setConversationActiveArtifact: vi.fn(),
}))

vi.mock('@/lib/db/repositories/documents', () => ({
  getArtifact: async (id: string) =>
    artifacts.find((artifact) => artifact.id === id) ?? null,
}))

vi.mock('@/lib/db/repositories/revisions', () => ({
  createRevision: vi.fn(async (data: Partial<ArtifactRevision>) => {
    const id = `rev-${revisions.length + 1}`
    const now = Date.now()
    revisions.push({
      id,
      artifact_id: data.artifact_id!,
      message_id: data.message_id ?? null,
      author: data.author!,
      content: data.content ?? '',
      created_at: now,
      updated_at: now,
    })
    return id
  }),
  updateRevisionContent: vi.fn(async (id: string, content: string) => {
    const revision = revisions.find((item) => item.id === id)
    if (revision) {
      revision.content = content
      revision.updated_at = Date.now()
    }
  }),
}))

vi.mock('@/lib/db/repositories/messages', () => ({
  createMessage: vi.fn(
    async (data: Partial<Message> & { metadata?: unknown }) => {
      const id = `${data.role}-${messages.length + 1}`
      messages.push({
        id,
        conversation_id: data.conversation_id!,
        role: data.role!,
        content: data.content ?? '',
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        sequence_order: data.sequence_order!,
        created_at: Date.now(),
      })
      return id
    }
  ),
  getMessage: async (id: string) =>
    messages.find((message) => message.id === id) ?? null,
  listMessages: async (conversationId: string) =>
    messages
      .filter((message) => message.conversation_id === conversationId)
      .sort((a, b) => a.sequence_order - b.sequence_order),
  listMessagesWithStreamStatus: async (status: string) =>
    messages.filter((message) => {
      const metadata = JSON.parse(message.metadata ?? '{}') as MessageMetadata
      return metadata.stream?.status === status
    }),
  updateMessageContentAndMetadata: vi.fn(
    async (id: string, content: string, metadata?: unknown) => {
      const message = messages.find((item) => item.id === id)
      if (message) {
        message.content = content
        message.metadata = metadata ? JSON.stringify(metadata) : null
      }
    }
  ),
}))

import { useBackgroundGenerationStore } from '../backgroundGenerationStore'

const generation: GenerationMetadata = {
  startedAt: 1000,
  completedAt: 1500,
  durationMs: 500,
  steps: [],
}

beforeEach(() => {
  useBackgroundGenerationStore.setState({ activeJobs: {} })
  useNotificationStore.getState().dismissAll()
  setCurrentRoutePathname('')
  messages.splice(0, messages.length)
  revisions.splice(0, revisions.length)
  vi.clearAllMocks()
  artifactApi.artifact = { id: 'active-art' }
  artifactApi.sealForSend.mockResolvedValue({
    artifactId: 'active-art',
    revisionId: 'user-rev',
    content: 'old artifact',
  })
  artifactApi.getArtifactContextForSend.mockImplementation(
    async (artifactId: string) => ({
      artifactId,
      revisionId: null,
      content: '',
    })
  )
  artifactApi.createNewArtifact.mockResolvedValue('active-art')
})

describe('useBackgroundGenerationStore', () => {
  it('persists streamed assistant text and artifact revision updates', async () => {
    sidecarApi.sendChatRequest.mockImplementation(
      async (_request, handlers) => {
        await handlers.onChunk('Done')
        await handlers.onArtifactChunk('# Draft')
        await handlers.onMessageComplete({
          messageId: null,
          content: 'Done',
          artifactContent: '# Draft',
          generation,
        })
        return { messages: [] }
      }
    )

    await useBackgroundGenerationStore.getState().startMessage({
      projectId: 'proj-1',
      conversationId: 'conv-1',
      content: 'write',
    })

    await vi.waitFor(() => {
      const assistant = messages.find((message) => message.role === 'assistant')
      const metadata = JSON.parse(
        assistant?.metadata ?? '{}'
      ) as MessageMetadata
      expect(assistant?.content).toBe('Done')
      expect(metadata.stream?.status).toBe('complete')
    })

    expect(messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
    ])
    expect(revisions[0]).toMatchObject({
      artifact_id: 'active-art',
      author: 'ai',
      content: '# Draft',
    })
    expect(artifactApi.upsertStreamingAiRevision).toHaveBeenCalled()
    expect(useBackgroundGenerationStore.getState().activeJobs).toEqual({})
  })

  it('pushes a completion notification when the completed chat is not open', async () => {
    setCurrentRoutePathname('/projects/proj-1')
    sidecarApi.sendChatRequest.mockImplementation(
      async (_request, handlers) => {
        await handlers.onMessageComplete({
          messageId: null,
          content: 'Done',
          artifactContent: null,
          generation,
        })
        return { messages: [] }
      }
    )

    await useBackgroundGenerationStore.getState().startMessage({
      projectId: 'proj-1',
      conversationId: 'conv-1',
      content: 'write',
    })

    await vi.waitFor(() => {
      expect(useNotificationStore.getState().notifications).toHaveLength(1)
    })

    expect(useNotificationStore.getState().notifications[0]).toMatchObject({
      kind: 'success',
      message: 'Background job finished',
      action: {
        label: 'View',
        to: '/projects/proj-1/chats/conv-1',
      },
    })
  })

  it('does not push a completion notification for the currently open chat', async () => {
    setCurrentRoutePathname('/projects/proj-1/chats/conv-1')
    sidecarApi.sendChatRequest.mockImplementation(
      async (_request, handlers) => {
        await handlers.onMessageComplete({
          messageId: null,
          content: 'Done',
          artifactContent: null,
          generation,
        })
        return { messages: [] }
      }
    )

    await useBackgroundGenerationStore.getState().startMessage({
      projectId: 'proj-1',
      conversationId: 'conv-1',
      content: 'write',
    })

    await vi.waitFor(() => {
      expect(useBackgroundGenerationStore.getState().activeJobs).toEqual({})
    })
    expect(useNotificationStore.getState().notifications).toEqual([])
  })

  it('supports active streams in multiple conversations', async () => {
    sidecarApi.sendChatRequest.mockImplementation(() => new Promise(() => {}))

    await useBackgroundGenerationStore.getState().startMessage({
      projectId: 'proj-1',
      conversationId: 'conv-1',
      content: 'first',
      artifactContext: { artifactId: 'active-art' },
    })
    await useBackgroundGenerationStore.getState().startMessage({
      projectId: 'proj-1',
      conversationId: 'conv-2',
      content: 'second',
      artifactContext: { artifactId: 'art-2' },
    })

    expect(
      Object.keys(useBackgroundGenerationStore.getState().activeJobs)
    ).toEqual(['conv-1', 'conv-2'])
  })

  it('marks orphaned active assistant messages as interrupted on recovery', async () => {
    messages.push({
      id: 'assistant-active',
      conversation_id: 'conv-1',
      role: 'assistant',
      content: 'partial',
      metadata: JSON.stringify({
        stream: {
          status: 'active',
          jobId: 'job-1',
          sourceUserMessageId: 'user-1',
          targetArtifactId: 'active-art',
          startedAt: 1000,
          updatedAt: 1000,
        },
      }),
      sequence_order: 0,
      created_at: 1000,
    })

    await useBackgroundGenerationStore.getState().recoverInterruptedStreams()

    const metadata = JSON.parse(messages[0].metadata ?? '{}') as MessageMetadata
    expect(metadata.stream?.status).toBe('interrupted')
  })

  it('regenerates from the original user message without replacing the interrupted attempt', async () => {
    sidecarApi.sendChatRequest.mockImplementation(() => new Promise(() => {}))
    messages.push(
      {
        id: 'user-1',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'try again',
        metadata: null,
        sequence_order: 0,
        created_at: 1000,
      },
      {
        id: 'assistant-interrupted',
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'partial',
        metadata: JSON.stringify({
          stream: {
            status: 'interrupted',
            jobId: 'job-old',
            sourceUserMessageId: 'user-1',
            targetArtifactId: 'active-art',
            startedAt: 1000,
            updatedAt: 1100,
            completedAt: 1100,
          },
        }),
        sequence_order: 1,
        created_at: 1100,
      }
    )

    await useBackgroundGenerationStore
      .getState()
      .regenerate('assistant-interrupted')

    expect(messages.filter((message) => message.role === 'user')).toHaveLength(
      1
    )
    expect(
      messages.filter((message) => message.role === 'assistant')
    ).toHaveLength(2)
    expect(sidecarApi.sendChatRequest.mock.calls[0][0]).toMatchObject({
      message: 'try again',
    })
  })
})
