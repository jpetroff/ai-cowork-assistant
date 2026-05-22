import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateMessage = vi.fn<(...args: unknown[]) => Promise<string>>()
const mockListMessages = vi.fn<() => Promise<[]>>()

vi.mock('@/lib/db/repositories/messages', () => ({
  createMessage: (...args: unknown[]) => mockCreateMessage(...args),
  listMessages: () => mockListMessages(),
}))

import { useMessageStore } from '../messageStore'

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
