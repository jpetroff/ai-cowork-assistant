import { beforeEach, describe, expect, it, vi } from 'vitest'

const { artifactApi, backgroundApi, messageApi } = vi.hoisted(() => {
  const listeners: Array<
    (state: { activeJobs: Record<string, unknown> }) => void
  > = []
  const backgroundApi = {
    activeJobs: {} as Record<string, unknown>,
    startMessage: vi.fn(),
    regenerate: vi.fn(),
    recoverInterruptedStreams: vi.fn(),
    emit() {
      for (const listener of listeners) {
        listener({ activeJobs: backgroundApi.activeJobs })
      }
    },
    subscribe(
      listener: (state: { activeJobs: Record<string, unknown> }) => void
    ) {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index >= 0) listeners.splice(index, 1)
      }
    },
  }

  return {
    artifactApi: {
      loadForConversation: vi.fn(),
      createNewArtifact: vi.fn(),
    },
    backgroundApi,
    messageApi: {
      loadForConversation: vi.fn(),
      conversationId: 'conv-1' as string | null,
    },
  }
})

vi.mock('@/components/chat/backgroundGenerationStore', () => ({
  useBackgroundGenerationStore: {
    getState: () => backgroundApi,
    subscribe: backgroundApi.subscribe,
  },
}))

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

import { useChatSessionStore } from '../chatSessionStore'

beforeEach(() => {
  useChatSessionStore.getState().reset()
  backgroundApi.activeJobs = {}
  vi.clearAllMocks()
  messageApi.loadForConversation.mockResolvedValue(undefined)
  artifactApi.loadForConversation.mockResolvedValue(undefined)
  artifactApi.createNewArtifact.mockResolvedValue('artifact-1')
  backgroundApi.startMessage.mockResolvedValue(undefined)
})

describe('useChatSessionStore', () => {
  it('loads message and artifact stores for the chat route context', async () => {
    await useChatSessionStore
      .getState()
      .loadChat({ projectId: 'proj-1', conversationId: 'conv-1' })

    expect(messageApi.loadForConversation).toHaveBeenCalledWith('conv-1')
    expect(artifactApi.loadForConversation).toHaveBeenCalledWith('conv-1')
    expect(useChatSessionStore.getState()).toMatchObject({
      status: 'ready',
      activeProjectId: 'proj-1',
      activeConversationId: 'conv-1',
      isAssistantStreaming: false,
    })
  })

  it('reflects active background jobs for the loaded conversation', async () => {
    backgroundApi.activeJobs = { 'conv-1': { jobId: 'job-1' } }

    await useChatSessionStore
      .getState()
      .loadChat({ projectId: 'proj-1', conversationId: 'conv-1' })

    expect(useChatSessionStore.getState().isAssistantStreaming).toBe(true)

    backgroundApi.activeJobs = {}
    backgroundApi.emit()

    expect(useChatSessionStore.getState().isAssistantStreaming).toBe(false)
  })

  it('creates a new document through the artifact store', async () => {
    await expect(
      useChatSessionStore.getState().createNewDocument('conv-1')
    ).resolves.toBe('artifact-1')

    expect(artifactApi.createNewArtifact).toHaveBeenCalledWith('conv-1')
  })

  it('delegates submit to the background generation store', async () => {
    await useChatSessionStore
      .getState()
      .loadChat({ projectId: 'proj-1', conversationId: 'conv-1' })

    await useChatSessionStore
      .getState()
      .submitMessage(' hello ', { artifactId: 'artifact-2' })

    expect(backgroundApi.startMessage).toHaveBeenCalledWith({
      projectId: 'proj-1',
      conversationId: 'conv-1',
      content: 'hello',
      artifactContext: { artifactId: 'artifact-2' },
    })
  })

  it('stores submit errors for the chat view', async () => {
    backgroundApi.startMessage.mockRejectedValueOnce(new Error('No model'))
    await useChatSessionStore
      .getState()
      .loadChat({ projectId: 'proj-1', conversationId: 'conv-1' })

    await useChatSessionStore.getState().submitMessage('hello')

    expect(useChatSessionStore.getState().error).toBe('No model')
  })
})
