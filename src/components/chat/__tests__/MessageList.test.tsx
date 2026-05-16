// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { Message } from '@/lib/db/types'

const { messageState, artifactState } = vi.hoisted(() => ({
  messageState: {
    status: 'ready',
    messages: [] as Message[],
    isStreaming: false,
    streamingContent: '',
  },
  artifactState: {
    loadedRevisionId: 'rev-loaded',
    requestRevisionLoad: vi.fn(),
    getArtifactRevisionMeta: vi.fn(() => ({
      artifact: { id: 'art-1', title: 'Loaded Document' },
      revision: { id: 'rev-loaded' },
    })),
  },
}))

vi.mock('@/stores/messageStore', () => ({
  useMessageStore: (selector: (s: typeof messageState) => unknown) =>
    selector(messageState),
}))

vi.mock('@/stores/artifactStore', () => ({
  useArtifactStore: (selector: (s: typeof artifactState) => unknown) =>
    selector(artifactState),
}))

import { MessageList } from '../MessageList'

Element.prototype.scrollIntoView = vi.fn()

function makeSystemMessage(revisionId: string): Message {
  return {
    id: `sys-${revisionId}`,
    conversation_id: 'conv-1',
    role: 'system',
    content: 'revision created',
    metadata: JSON.stringify({
      artifactId: 'art-1',
      revisionId,
      author: 'user',
    }),
    sequence_order: 1,
    created_at: 1000,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  messageState.messages = []
  artifactState.loadedRevisionId = 'rev-loaded'
})

describe('MessageList', () => {
  it('marks the revision card active when it matches loadedRevisionId', () => {
    messageState.messages = [makeSystemMessage('rev-loaded')]

    render(<MessageList />)

    const button = screen.getByRole('button', {
      name: /loaded artifact revision/i,
    })
    expect(button).toBeDisabled()
  })
})
