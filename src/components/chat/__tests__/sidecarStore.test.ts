import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener = (
  message:
    | { type: 'Text'; data: string }
    | { type: 'Close'; data: { code: number; reason: string } | null }
) => void

type SocketFrame =
  | Record<string, unknown>
  | { frameType: 'Close'; data: { code: number; reason: string } | null }

const websocketMock = vi.hoisted(() => {
  let frames: SocketFrame[] = []
  const instances: Array<{
    addListener: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
    emitFrame: (frame: SocketFrame) => void
    listeners: Listener[]
    send: ReturnType<typeof vi.fn>
    sent: string[]
  }> = []

  const toSocketMessage = (frame: SocketFrame) => {
    if (
      frame &&
      typeof frame === 'object' &&
      'frameType' in frame &&
      frame.frameType === 'Close'
    ) {
      const closeFrame = frame as {
        data: { code: number; reason: string } | null
      }
      return { type: 'Close' as const, data: closeFrame.data }
    }

    return { type: 'Text' as const, data: JSON.stringify(frame) }
  }

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
      emitFrame(frame: SocketFrame) {
        const message = toSocketMessage(frame)
        for (const listener of instance.listeners) {
          listener(message)
        }
      },
      send: vi.fn(async (message: string) => {
        instance.sent.push(message)
        for (const frame of frames) {
          instance.emitFrame(frame)
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
    setFrames(nextFrames: SocketFrame[]) {
      frames = nextFrames
    },
  }
})

function closeFrame(code = 1000, reason = 'workflow.complete'): SocketFrame {
  return { frameType: 'Close', data: { code, reason } }
}

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
  llm_provider: {
    provider_id: 'provider-1',
    provider_type: 'ollama',
    name: 'Ollama',
    base_url: 'http://localhost:11434',
    api_key: null,
    model: 'llama3',
    config: {},
  },
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
      closeFrame(),
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
    expect(result?.messages).toHaveLength(1)
    expect(result?.messages[0]).toMatchObject({
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
      closeFrame(),
    ])
    const onStep = vi.fn()

    const result = await useSidecarStore
      .getState()
      .sendChatRequest(request, { onStep })

    expect(onStep).toHaveBeenCalled()
    expect(result?.messages[0].generation.steps).toEqual([
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
      closeFrame(),
    ])

    await expect(
      useSidecarStore.getState().sendChatRequest(request)
    ).resolves.toMatchObject({
      messages: [
        {
          messageId: null,
          content: 'Done.',
          artifactContent: null,
          generation: {
            startedAt: expect.any(Number),
            completedAt: expect.any(Number),
            durationMs: expect.any(Number),
            steps: [],
          },
        },
      ],
    })
  })

  it('keeps listening after completion.response until the websocket closes', async () => {
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

    let settled = false
    const resultPromise = useSidecarStore
      .getState()
      .sendChatRequest(request)
      .then((result) => {
        settled = true
        return result
      })

    await Promise.resolve()
    await Promise.resolve()

    expect(settled).toBe(false)

    websocketMock.instances[0].emitFrame(closeFrame())

    await expect(resultPromise).resolves.toMatchObject({
      messages: [
        expect.objectContaining({
          content: 'Done.',
        }),
      ],
    })
  })

  it('resolves multiple completed messages with separate generation timelines', async () => {
    useSidecarStore.setState({
      sidecarUrl: 'http://127.0.0.1:9720',
      isConnected: true,
    })
    websocketMock.setFrames([
      { type: 'completion.chunk.thinking', content: 'first thought' },
      { type: 'completion.chunk', content: 'First.' },
      { type: 'completion.response', content: '' },
      { type: 'completion.chunk.thinking', content: 'second thought' },
      { type: 'completion.chunk', content: 'Second.' },
      { type: 'completion.response', content: '' },
      closeFrame(),
    ])
    const onMessageComplete = vi.fn(async (message) =>
      message.content === 'First.' ? 'assistant-1' : 'assistant-2'
    )

    const result = await useSidecarStore
      .getState()
      .sendChatRequest(request, { onMessageComplete })

    expect(onMessageComplete).toHaveBeenCalledTimes(2)
    expect(result?.messages).toHaveLength(2)
    expect(result?.messages.map((message) => message.messageId)).toEqual([
      'assistant-1',
      'assistant-2',
    ])
    expect(result?.messages[0]).toMatchObject({
      content: 'First.',
      generation: {
        steps: [
          expect.objectContaining({
            id: 'step-1',
            kind: 'thinking',
            content: 'first thought',
          }),
        ],
      },
    })
    expect(result?.messages[1]).toMatchObject({
      content: 'Second.',
      generation: {
        steps: [
          expect.objectContaining({
            id: 'step-1',
            kind: 'thinking',
            content: 'second thought',
          }),
        ],
      },
    })
  })

  it('resolves an empty workflow on normal close with no active message', async () => {
    useSidecarStore.setState({
      sidecarUrl: 'http://127.0.0.1:9720',
      isConnected: true,
    })
    websocketMock.setFrames([closeFrame()])

    await expect(
      useSidecarStore.getState().sendChatRequest(request)
    ).resolves.toEqual({ messages: [] })
  })

  it('rejects when the websocket closes before the active message completes', async () => {
    useSidecarStore.setState({
      sidecarUrl: 'http://127.0.0.1:9720',
      isConnected: true,
    })
    websocketMock.setFrames([
      { type: 'completion.chunk', content: 'partial' },
      closeFrame(),
    ])

    await expect(
      useSidecarStore.getState().sendChatRequest(request)
    ).rejects.toThrow(/closed before message completion/)
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
      closeFrame(),
    ])

    await expect(
      useSidecarStore.getState().sendChatRequest(request)
    ).resolves.toMatchObject({
      messages: [
        {
          messageId: null,
          content: 'followup',
          artifactContent: 'artifact',
          generation: expect.objectContaining({
            steps: [],
          }),
        },
      ],
    })
  })

  it('rejects for Python error payloads', async () => {
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
    ).rejects.toThrow('validation failed')
  })
})
