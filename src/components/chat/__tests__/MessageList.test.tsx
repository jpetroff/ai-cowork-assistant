// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Message } from '@/lib/db/types'

const { messageState } = vi.hoisted(() => ({
  messageState: {
    status: 'ready',
    messages: [] as Message[],
    isStreaming: false,
    streamingContent: '',
    streamingGeneration: null as
      | import('../generationMetadata').GenerationMetadata
      | null,
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
  messageState.isStreaming = false
  messageState.streamingContent = ''
  messageState.streamingGeneration = null
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

  it('renders a live generation step instead of loading dots', () => {
    messageState.isStreaming = true
    messageState.streamingGeneration = {
      startedAt: 1000,
      steps: [
        {
          id: 'step-1',
          kind: 'event',
          title: 'Generating artifact...',
          startedAt: 1000,
        },
      ],
    }

    render(<MessageList />)

    expect(screen.getByText('Generating artifact...')).toBeInTheDocument()
    expect(screen.queryByText('•••')).not.toBeInTheDocument()
  })

  it('opens the live generation drawer with step details', async () => {
    const user = userEvent.setup()
    messageState.isStreaming = true
    messageState.streamingGeneration = {
      startedAt: 1000,
      steps: [
        {
          id: 'step-1',
          kind: 'thinking',
          title: 'Thinking',
          content: 'internal notes',
          startedAt: 1000,
        },
      ],
    }

    render(<MessageList />)
    await user.click(screen.getByRole('button', { name: 'Thinking' }))

    expect(
      screen.getByRole('heading', { name: 'Generation steps' })
    ).toBeInTheDocument()
    expect(screen.getByText('internal notes')).toBeInTheDocument()
  })

  it('renders completed generation metadata and opens the drawer', async () => {
    const user = userEvent.setup()
    messageState.messages = [
      makeMessage({
        id: 'assistant-1',
        role: 'assistant',
        content: 'done',
        metadata: JSON.stringify({
          generation: {
            startedAt: 1000,
            completedAt: 2500,
            durationMs: 1500,
            steps: [
              {
                id: 'step-1',
                kind: 'event',
                title: 'Finalizing workflow',
                payload: { event_name: 'ProgressEvent' },
                startedAt: 1000,
                endedAt: 2500,
                durationMs: 1500,
              },
            ],
          },
        }),
      }),
    ]

    render(<MessageList />)
    await user.click(screen.getByRole('button', { name: 'Thought for 2 sec' }))

    expect(screen.getByText(/Finalizing workflow/)).toBeInTheDocument()
    expect(screen.getByText(/ProgressEvent/)).toBeInTheDocument()
  })
})
