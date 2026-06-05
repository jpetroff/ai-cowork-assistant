// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useConversationStore } from '@/components/conversations/conversationStore'
import { useNotificationStore } from '@/components/ui/notificationStore'
import type { Conversation } from '@/lib/db/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

const mockCreateConversation = vi.fn()
const mockStartMessage = vi.fn()

vi.mock('@/lib/db/repositories/conversations', () => ({
  listConversations: vi.fn(async () => []),
  createConversation: (...args: unknown[]) => mockCreateConversation(...args),
  updateConversation: vi.fn(async () => {}),
  deleteConversation: vi.fn(async () => {}),
}))

vi.mock('@/components/chat/backgroundGenerationStore', () => ({
  useBackgroundGenerationStore: {
    getState: () => ({
      startMessage: (...args: unknown[]) => mockStartMessage(...args),
    }),
  },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { NewTaskInput } from '../NewTaskInput'

function makeConversation(id: string): Conversation {
  return {
    id,
    project_id: 'proj-1',
    title: null,
    active_artifact_id: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  }
}

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
  useNotificationStore.getState().dismissAll()
  mockNavigate.mockReset()
  mockCreateConversation.mockReset()
  mockStartMessage.mockReset()
  mockStartMessage.mockResolvedValue(undefined)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NewTaskInput — render', () => {
  it('renders the textarea with placeholder text', () => {
    render(<NewTaskInput projectId='proj-1' />)
    expect(
      screen.getByPlaceholderText(/what would you like to work on/i)
    ).toBeTruthy()
  })

  it('Send button is disabled when textarea is empty', () => {
    render(<NewTaskInput projectId='proj-1' />)
    const btn = screen.getByRole('button', { name: /start task/i })
    expect(btn).toBeDisabled()
  })

  it('Send button is disabled when textarea contains only whitespace', async () => {
    render(<NewTaskInput projectId='proj-1' />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, '   ')
    expect(screen.getByRole('button', { name: /start task/i })).toBeDisabled()
  })

  it('Send button is enabled when textarea has non-whitespace content', async () => {
    render(<NewTaskInput projectId='proj-1' />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Analyze my notes')
    expect(
      screen.getByRole('button', { name: /start task/i })
    ).not.toBeDisabled()
  })
})

describe('NewTaskInput — submission', () => {
  it('creates a conversation, starts generation, and navigates on Send button click', async () => {
    const newConv = makeConversation('new-chat-id')
    mockCreateConversation.mockResolvedValue(newConv.id)

    render(<NewTaskInput projectId='proj-1' />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Summarize my documents')
    await userEvent.click(screen.getByRole('button', { name: /start task/i }))

    expect(mockCreateConversation).toHaveBeenCalledWith({
      project_id: 'proj-1',
    })
    expect(mockStartMessage).toHaveBeenCalledWith({
      projectId: 'proj-1',
      conversationId: 'new-chat-id',
      content: 'Summarize my documents',
      artifactContext: null,
    })
    expect(mockNavigate).toHaveBeenCalledWith(
      '/projects/proj-1/chats/new-chat-id'
    )
    expect(
      mockStartMessage.mock.invocationCallOrder[0]
    ).toBeLessThan(mockNavigate.mock.invocationCallOrder[0])
  })

  it('plain Enter key inserts a newline, does not submit', async () => {
    render(<NewTaskInput projectId='proj-1' />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'line one')
    await userEvent.keyboard('{Enter}')

    expect(mockCreateConversation).not.toHaveBeenCalled()
    expect((textarea as HTMLTextAreaElement).value).toContain('\n')
  })

  it('Ctrl+Enter submits the form', async () => {
    const newConv = makeConversation('ctrl-enter-chat')
    mockCreateConversation.mockResolvedValue(newConv.id)

    render(<NewTaskInput projectId='proj-1' />)
    const textarea = screen.getByRole('textbox')
    await userEvent.type(textarea, 'Task description')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')

    expect(mockCreateConversation).toHaveBeenCalled()
    expect(mockStartMessage).toHaveBeenCalledWith({
      projectId: 'proj-1',
      conversationId: 'ctrl-enter-chat',
      content: 'Task description',
      artifactContext: null,
    })
  })

  it('does not submit when textarea is empty and Ctrl+Enter is pressed', async () => {
    render(<NewTaskInput projectId='proj-1' />)
    const textarea = screen.getByRole('textbox')
    await userEvent.click(textarea)
    await userEvent.keyboard('{Control>}{Enter}{/Control}')

    expect(mockCreateConversation).not.toHaveBeenCalled()
    expect(mockStartMessage).not.toHaveBeenCalled()
  })

  it('keeps the typed prompt and reports an error when generation startup fails', async () => {
    const newConv = makeConversation('failed-chat-id')
    mockCreateConversation.mockResolvedValue(newConv.id)
    mockStartMessage.mockRejectedValueOnce(new Error('No model configured'))

    render(<NewTaskInput projectId='proj-1' />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    await userEvent.type(textarea, 'Draft the proposal')
    await userEvent.click(screen.getByRole('button', { name: /start task/i }))

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(textarea.value).toBe('Draft the proposal')
    expect(useConversationStore.getState().conversations[0].id).toBe(
      'failed-chat-id'
    )
    expect(useNotificationStore.getState().notifications[0]).toMatchObject({
      kind: 'error',
      message: 'Could not start generation',
      detail: 'No model configured',
    })
  })
})
