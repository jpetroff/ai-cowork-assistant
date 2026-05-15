import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mock repositories ──────────────────────────────────────────────────────────

const mockCreateMessage = vi.fn<(...args: unknown[]) => Promise<string>>()
const mockCreateSystemRevisionMessage =
  vi.fn<(...args: unknown[]) => Promise<string>>()
const mockListMessages = vi.fn<() => Promise<[]>>()

vi.mock('@/lib/db/repositories/messages', () => ({
  createMessage: (...args: unknown[]) => mockCreateMessage(...args),
  createSystemRevisionMessage: (...args: unknown[]) =>
    mockCreateSystemRevisionMessage(...args),
  listMessages: () => mockListMessages(),
}))

// ── Import after mocks ─────────────────────────────────────────────────────────

import { useMessageStore } from '../messageStore'

// ── Reset store between tests ──────────────────────────────────────────────────

beforeEach(() => {
  useMessageStore.getState().clear()
  vi.clearAllMocks()
  mockListMessages.mockResolvedValue([])
  mockCreateMessage.mockResolvedValue('msg-1')
  mockCreateSystemRevisionMessage.mockResolvedValue('sys-1')
})

// ── addSystemRevisionMessage ───────────────────────────────────────────────────

describe('addSystemRevisionMessage', () => {
  it('throws when no active conversation', async () => {
    await expect(
      useMessageStore
        .getState()
        .addSystemRevisionMessage('user', 'art-1', 'rev-1')
    ).rejects.toThrow('No active conversation')
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
    mockCreateSystemRevisionMessage.mockResolvedValue('sys-new')

    await useMessageStore
      .getState()
      .addSystemRevisionMessage('user', 'art-1', 'rev-abc')

    expect(mockCreateSystemRevisionMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sequence_order: 5,
        author: 'user',
        artifactId: 'art-1',
        revisionId: 'rev-abc',
      })
    )
  })

  it('uses sequence_order 0 when messages list is empty', async () => {
    useMessageStore.setState({ conversationId: 'conv-1', messages: [] })
    await useMessageStore
      .getState()
      .addSystemRevisionMessage('ai', 'art-1', 'rev-1')
    expect(mockCreateSystemRevisionMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sequence_order: 0 })
    )
  })

  it('appends system message to messages state with correct shape including artifactId', async () => {
    useMessageStore.setState({ conversationId: 'conv-1', messages: [] })
    mockCreateSystemRevisionMessage.mockResolvedValue('sys-new')

    const id = await useMessageStore
      .getState()
      .addSystemRevisionMessage('ai', 'art-xyz', 'rev-xyz')

    expect(id).toBe('sys-new')
    const { messages } = useMessageStore.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0].role).toBe('system')
    expect(messages[0].id).toBe('sys-new')
    const meta = JSON.parse(messages[0].metadata!)
    expect(meta).toEqual({
      artifactId: 'art-xyz',
      revisionId: 'rev-xyz',
      author: 'ai',
    })
  })

  it('returns the new message id', async () => {
    useMessageStore.setState({ conversationId: 'conv-1', messages: [] })
    mockCreateSystemRevisionMessage.mockResolvedValue('sys-returned')
    const result = await useMessageStore
      .getState()
      .addSystemRevisionMessage('user', 'art-1', 'rev-1')
    expect(result).toBe('sys-returned')
  })
})
