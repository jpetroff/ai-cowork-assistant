import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (message: { type: string; data?: string }) => void

const websocketMock = vi.hoisted(() => {
  let frames: unknown[] = []
  const instances: Array<{
    addListener: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    listeners: Listener[]
    send: ReturnType<typeof vi.fn>
    sent: string[]
  }> = []

  const connect = vi.fn(async () => {
    const instance = {
      listeners: [] as Listener[],
      sent: [] as string[],
      addListener: vi.fn((listener: Listener) => {
        instance.listeners.push(listener)
        return () => {
          instance.listeners = instance.listeners.filter(
            (item) => item !== listener
          )
        }
      }),
      send: vi.fn(async (message: string) => {
        instance.sent.push(message)
        for (const frame of frames) {
          for (const listener of instance.listeners) {
            listener({ type: 'Text', data: JSON.stringify(frame) })
          }
        }
      }),
      disconnect: vi.fn(async () => undefined),
    }
    instances.push(instance)
    return instance
  })

  return {
    connect,
    instances,
    setFrames(nextFrames: unknown[]) {
      frames = nextFrames
    },
  }
})

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

vi.mock('@tauri-apps/plugin-websocket', () => ({
  default: {
    connect: websocketMock.connect,
  },
}))

import { useSidecarStore, type ChatCompletionRequest } from '../sidecarStore'

const request: ChatCompletionRequest = {
  message: 'write the artifact',
  chat_history: [{ role: 'assistant', content: 'previous answer' }],
  artifact: {
    artifact_id: 'art-1',
    revision_id: 'rev-1',
    content: 'old artifact',
  },
}

beforeEach(() => {
  useSidecarStore.setState({ sidecarUrl: null, isConnected: false })
  vi.clearAllMocks()
  websocketMock.instances.splice(0, websocketMock.instances.length)
  websocketMock.setFrames([])
})

describe('useSidecarStore', () => {
  it('initializes from the Tauri sidecar command', async () => {
    invokeMock.mockResolvedValue({
      available: true,
      url: 'http://127.0.0.1:9720',
    })

    await useSidecarStore.getState().init()

    expect(invokeMock).toHaveBeenCalledWith('init')
    expect(useSidecarStore.getState().sidecarUrl).toBe('http://127.0.0.1:9720')
    expect(useSidecarStore.getState().isConnected).toBe(true)
  })

  it('routes typed artifact chunks separately from assistant text chunks', async () => {
    useSidecarStore.setState({
      sidecarUrl: 'http://127.0.0.1:9720',
      isConnected: true,
    })
    websocketMock.setFrames([
      { type: 'event', payload: { msg: 'Processing' } },
      { type: 'completion.chunk.thinking', content: 'internal notes' },
      {
        type: 'completion.chunk',
        content_type: 'text/markdown',
        content: '# Title\n',
      },
      {
        type: 'completion.chunk',
        content_type: 'text/markdown',
        content: 'Body\n\n',
      },
      { type: 'completion.chunk', content: 'Created it.' },
      { type: 'completion.response', content: '' },
    ])
    const onChunk = vi.fn()
    const onArtifactChunk = vi.fn()

    const result = await useSidecarStore
      .getState()
      .sendChatRequest(request, { onChunk, onArtifactChunk })

    expect(websocketMock.connect).toHaveBeenCalledWith(
      'ws://127.0.0.1:9720/completion'
    )
    expect(websocketMock.instances[0].sent).toEqual([JSON.stringify(request)])
    expect(onChunk).toHaveBeenCalledTimes(1)
    expect(onChunk).toHaveBeenCalledWith('Created it.')
    expect(onArtifactChunk).toHaveBeenCalledTimes(2)
    expect(onArtifactChunk).toHaveBeenNthCalledWith(1, '# Title\n')
    expect(onArtifactChunk).toHaveBeenNthCalledWith(2, 'Body\n\n')
    expect(result).toMatchObject({
      messageId: null,
      content: 'Created it.',
      artifactContent: '# Title\nBody',
      generation: {
        startedAt: expect.any(Number),
        completedAt: expect.any(Number),
        durationMs: expect.any(Number),
        steps: [
          expect.objectContaining({
            id: 'step-1',
            kind: 'event',
            title: 'Processing',
            payload: { msg: 'Processing' },
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
            durationMs: expect.any(Number),
          }),
          expect.objectContaining({
            id: 'step-2',
            kind: 'thinking',
            title: 'Thinking',
            content: 'internal notes',
            startedAt: expect.any(Number),
            endedAt: expect.any(Number),
            durationMs: expect.any(Number),
          }),
        ],
      },
    })
    expect(websocketMock.instances[0].disconnect).toHaveBeenCalled()
  })

  it('supports alternate thinking event spelling and strips artifact payload fields', async () => {
    useSidecarStore.setState({
      sidecarUrl: 'http://127.0.0.1:9720',
      isConnected: true,
    })
    websocketMock.setFrames([
      { type: 'chunk.completion.thinking', content: 'first ' },
      { type: 'chunk.completion.thinking', content: 'second' },
      {
        type: 'event',
        payload: {
          event_name: 'ArtifactGeneratedEvent',
          artifact: { content: 'old' },
          artifact_text: 'new artifact',
          message_text: 'followup',
        },
      },
      { type: 'completion.response', content: 'Done.' },
    ])
    const onStep = vi.fn()

    const result = await useSidecarStore
      .getState()
      .sendChatRequest(request, { onStep })

    expect(onStep).toHaveBeenCalled()
    expect(result?.generation.steps).toEqual([
      expect.objectContaining({
        kind: 'thinking',
        title: 'Thinking',
        content: 'first second',
      }),
      expect.objectContaining({
        kind: 'event',
        title: 'ArtifactGeneratedEvent',
        payload: {
          event_name: 'ArtifactGeneratedEvent',
          message_text: 'followup',
        },
      }),
    ])
  })

  it('uses completion.response content as final assistant text', async () => {
    useSidecarStore.setState({
      sidecarUrl: 'http://127.0.0.1:9720',
      isConnected: true,
    })
    websocketMock.setFrames([
      {
        type: 'completion.response',
        content: 'Done.',
      },
    ])

    await expect(
      useSidecarStore.getState().sendChatRequest(request)
    ).resolves.toMatchObject({
      messageId: null,
      content: 'Done.',
      artifactContent: null,
      generation: {
        startedAt: expect.any(Number),
        completedAt: expect.any(Number),
        durationMs: expect.any(Number),
        steps: [],
      },
    })
  })

  it('accumulates mixed typed and untyped chunks into separate final content', async () => {
    useSidecarStore.setState({
      sidecarUrl: 'http://127.0.0.1:9720',
      isConnected: true,
    })
    websocketMock.setFrames([
      {
        type: 'completion.chunk',
        content_type: 'text/markdown',
        content: 'artifact',
      },
      { type: 'completion.chunk', content: 'followup' },
      { type: 'completion.response', content: '' },
    ])

    await expect(
      useSidecarStore.getState().sendChatRequest(request)
    ).resolves.toMatchObject({
      messageId: null,
      content: 'followup',
      artifactContent: 'artifact',
      generation: expect.objectContaining({
        steps: [],
      }),
    })
  })

  it('returns null for Python error payloads', async () => {
    useSidecarStore.setState({
      sidecarUrl: 'http://127.0.0.1:9720',
      isConnected: true,
    })
    websocketMock.setFrames([
      {
        type: 'error',
        payload: { message: 'validation failed', code: 'internal_error' },
      },
    ])

    await expect(
      useSidecarStore.getState().sendChatRequest(request)
    ).resolves.toBe(null)
  })
})
