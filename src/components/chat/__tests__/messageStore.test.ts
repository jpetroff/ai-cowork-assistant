import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateMessage = vi.fn<(...args: unknown[]) => Promise<string>>()
const mockListMessages = vi.fn<() => Promise<[]>>()

vi.mock('@/lib/db/repositories/messages', () => ({
  createMessage: (...args: unknown[]) => mockCreateMessage(...args),
  listMessages: () => mockListMessages(),
}))

import { useMessageStore } from '../messageStore'
import type { MessageMetadata } from '../generationMetadata'

beforeEach(() => {
  useMessageStore.getState().clear()
  vi.clearAllMocks()
  mockListMessages.mockResolvedValue([])
  mockCreateMessage.mockResolvedValue('msg-1')
})

describe('addUserMessage', () => {
  it('returns null when no conversation is active', async () => {
    await expect(useMessageStore.getState().addUserMessage('hi')).resolves.toBe(
      null
    )
    expect(mockCreateMessage).not.toHaveBeenCalled()
  })

  it('computes sequence_order as last message sequence_order + 1', async () => {
    useMessageStore.setState({
      conversationId: 'conv-1',
      messages: [
        {
          id: 'msg-0',
          conversation_id: 'conv-1',
          role: 'user',
          content: 'hi',
          metadata: null,
          sequence_order: 4,
          created_at: Date.now(),
        },
      ],
    })
    mockCreateMessage.mockResolvedValue('msg-new')

    const id = await useMessageStore.getState().addUserMessage('hello')

    expect(id).toBe('msg-new')
    expect(mockCreateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-1',
        role: 'user',
        content: 'hello',
        sequence_order: 5,
      })
    )
  })

  it('appends the created user message to state', async () => {
    useMessageStore.setState({ conversationId: 'conv-1', messages: [] })
    mockCreateMessage.mockResolvedValue('msg-new')

    await useMessageStore.getState().addUserMessage('hello')

    expect(useMessageStore.getState().messages).toEqual([
      expect.objectContaining({
        id: 'msg-new',
        conversation_id: 'conv-1',
        role: 'user',
        content: 'hello',
        metadata: null,
        sequence_order: 0,
      }),
    ])
  })
})

describe('finalizeStreaming', () => {
  it('persists assistant generation metadata', async () => {
    useMessageStore.setState({ conversationId: 'conv-1', messages: [] })
    mockCreateMessage.mockResolvedValue('assistant-1')
    const metadata: MessageMetadata = {
      generation: {
        startedAt: 1000,
        completedAt: 2500,
        durationMs: 1500,
        steps: [
          {
            id: 'step-1',
            kind: 'thinking',
            title: 'Thinking',
            content: 'notes',
            startedAt: 1000,
            endedAt: 2500,
            durationMs: 1500,
          },
        ],
      },
    }

    const id = await useMessageStore
      .getState()
      .finalizeStreaming(null, 'done', metadata)

    expect(id).toBe('assistant-1')
    expect(mockCreateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-1',
        role: 'assistant',
        content: 'done',
        metadata,
        sequence_order: 0,
      })
    )
    expect(useMessageStore.getState().messages[0]).toEqual(
      expect.objectContaining({
        id: 'assistant-1',
        role: 'assistant',
        metadata: JSON.stringify(metadata),
      })
    )
  })
})
