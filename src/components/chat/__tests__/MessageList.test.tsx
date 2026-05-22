// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { Message } from '@/lib/db/types'

const { messageState } = vi.hoisted(() => ({
  messageState: {
    status: 'ready',
    messages: [] as Message[],
    isStreaming: false,
    streamingContent: '',
  },
}))

vi.mock('@/components/chat/messageStore', () => ({
  useMessageStore: (selector: (s: typeof messageState) => unknown) =>
    selector(messageState),
}))

import { MessageList } from '../MessageList'

Element.prototype.scrollIntoView = vi.fn()

function makeMessage(overrides: Partial<Message>): Message {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    role: 'user',
    content: 'hello',
    metadata: null,
    sequence_order: 1,
    created_at: 1000,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  messageState.messages = []
})

describe('MessageList', () => {
  it('renders user and assistant messages', () => {
    messageState.messages = [
      makeMessage({ id: 'user-1', role: 'user', content: 'hello' }),
      makeMessage({
        id: 'assistant-1',
        role: 'assistant',
        content: 'hi there',
        created_at: 1001,
      }),
    ]

    render(<MessageList />)

    expect(screen.getByText('hello')).toBeInTheDocument()
    expect(screen.getByText('hi there')).toBeInTheDocument()
  })

  it('does not render artifact system messages', () => {
    messageState.messages = [
      makeMessage({
        id: 'sys-1',
        role: 'system',
        content: 'user created artifact revision',
        metadata: JSON.stringify({
          artifactId: 'art-1',
          revisionId: 'rev-1',
          author: 'user',
        }),
      }),
    ]

    render(<MessageList />)

    expect(
      screen.queryByText('user created artifact revision')
    ).not.toBeInTheDocument()
  })
})
