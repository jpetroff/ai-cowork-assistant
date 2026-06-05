// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useConversationStore } from '@/components/conversations/conversationStore'

const mockNavigate = vi.fn()
const mockCreateConversation = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

vi.mock('@/lib/db/repositories/conversations', () => ({
  listConversations: vi.fn(async () => []),
  createConversation: (...args: unknown[]) => mockCreateConversation(...args),
  updateConversation: vi.fn(async () => {}),
  deleteConversation: vi.fn(async () => {}),
}))

import { CreateEmptyChatButton } from '../CreateEmptyChatButton'

afterEach(cleanup)

beforeEach(() => {
  useConversationStore.setState({
    conversations: [],
    activeConversationId: null,
    activeProjectId: null,
    status: 'ready',
    error: null,
    operationStates: {},
  })
  mockNavigate.mockReset()
  mockCreateConversation.mockReset()
})

describe('CreateEmptyChatButton', () => {
  it('creates an empty chat and navigates to it', async () => {
    mockCreateConversation.mockResolvedValue('chat-1')

    render(<CreateEmptyChatButton projectId='proj-1' />)
    await userEvent.click(
      screen.getByRole('button', { name: /new empty chat/i })
    )

    expect(mockCreateConversation).toHaveBeenCalledWith({
      project_id: 'proj-1',
    })
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-1/chats/chat-1')
    expect(useConversationStore.getState().conversations[0]).toMatchObject({
      id: 'chat-1',
      project_id: 'proj-1',
      active_artifact_id: null,
    })
  })

  it('does not navigate when chat creation fails', async () => {
    mockCreateConversation.mockRejectedValue(new Error('write failed'))

    render(<CreateEmptyChatButton projectId='proj-1' />)
    await userEvent.click(
      screen.getByRole('button', { name: /new empty chat/i })
    )

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
