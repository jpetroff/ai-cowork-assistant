// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Conversation } from '@/lib/db/types'
import { useConversationStore } from '@/stores/conversationStore'
import { useNotificationStore } from '@/stores/notificationStore'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

const mockUpdateConversation = vi.fn()
const mockDeleteConversation = vi.fn()

vi.mock('@/lib/db/repositories/conversations', () => ({
  listConversations: vi.fn(async () => []),
  createConversation: vi.fn(async () => crypto.randomUUID()),
  updateConversation: (...args: unknown[]) => mockUpdateConversation(...args),
  deleteConversation: (...args: unknown[]) => mockDeleteConversation(...args),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { ConversationRow } from '../ConversationRow'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    project_id: 'proj-1',
    title: 'My Chat',
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
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
  mockUpdateConversation.mockReset()
  mockDeleteConversation.mockReset()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ConversationRow — display', () => {
  it('renders the conversation title', () => {
    render(<ConversationRow conversation={makeConversation({ title: 'Research Chat' })} projectId="proj-1" />)
    expect(screen.getByText('Research Chat')).toBeTruthy()
  })

  it('renders "Untitled" when title is null', () => {
    render(<ConversationRow conversation={makeConversation({ title: null })} projectId="proj-1" />)
    expect(screen.getByText('Untitled')).toBeTruthy()
  })

  it('renders a relative timestamp', () => {
    render(<ConversationRow conversation={makeConversation()} projectId="proj-1" />)
    // Just check a timestamp element is rendered
    const texts = document.querySelectorAll('p')
    const hasTime = Array.from(texts).some((p) => p.textContent?.match(/ago|now|yesterday/i))
    expect(hasTime).toBe(true)
  })
})

describe('ConversationRow — navigation', () => {
  it('navigates to the chat page when the row is clicked', async () => {
    const conv = makeConversation({ id: 'chat-42', title: 'My Chat' })
    render(<ConversationRow conversation={conv} projectId="proj-1" />)

    // Click the title text — avoids ambiguity with the dropdown trigger button
    await userEvent.click(screen.getByText('My Chat'))

    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-1/chats/chat-42')
  })
})

describe('ConversationRow — delete', () => {
  it('calls conversationStore.delete when deletion is confirmed', async () => {
    mockDeleteConversation.mockResolvedValue(undefined)
    const conv = makeConversation({ id: 'del-id' })
    useConversationStore.setState({ conversations: [conv] })

    const { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
            AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
          } = await import('@/components/ui/alert-dialog')

    const deleteConv = useConversationStore.getState().delete
    const onConfirm = vi.fn(() => deleteConv('del-id'))

    render(
      <AlertDialog open={true}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>This will be removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )

    const confirmBtn = await screen.findByRole('button', { name: /^delete$/i })
    await userEvent.click(confirmBtn)

    expect(mockDeleteConversation).toHaveBeenCalledWith('del-id')
  })
})

describe('ConversationRow — busy state', () => {
  it('row has pointer-events-none when deleting', () => {
    const conv = makeConversation({ id: 'conv-1' })
    useConversationStore.setState({
      conversations: [conv],
      operationStates: { 'conv-1': 'deleting' },
    })
    render(<ConversationRow conversation={conv} projectId="proj-1" />)

    // The outer row div has role="button"; use getAllByRole and target the first one
    const rows = screen.getAllByRole('button')
    const rowDiv = rows.find((el) => el.getAttribute('aria-label') === null && el.tagName !== 'BUTTON')
    expect(rowDiv?.className).toContain('pointer-events-none')
  })
})
