import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Conversation } from '@/lib/db/types'

// ── Mock repositories ─────────────────────────────────────────────────────────

const mockListConversations = vi.fn<() => Promise<Conversation[]>>()
const mockCreateConversation = vi.fn<() => Promise<string>>()
const mockUpdateConversation = vi.fn<() => Promise<void>>()
const mockDeleteConversation = vi.fn<() => Promise<void>>()

vi.mock('@/lib/db/repositories/conversations', () => ({
  listConversations: () => mockListConversations(),
  createConversation: (...args: unknown[]) => mockCreateConversation(...args),
  updateConversation: (...args: unknown[]) => mockUpdateConversation(...args),
  deleteConversation: (...args: unknown[]) => mockDeleteConversation(...args),
}))

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => ({ select: vi.fn(), execute: vi.fn() })) },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useConversationStore } from '../conversationStore'
import { useNotificationStore } from '../notificationStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: crypto.randomUUID(),
    project_id: 'proj-1',
    title: 'Test chat',
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  useConversationStore.setState({
    conversations: [],
    activeConversationId: null,
    activeProjectId: null,
    status: 'idle',
    error: null,
    operationStates: {},
  })
  useNotificationStore.getState().dismissAll()
  vi.clearAllMocks()
})

// ── loadForProject() ──────────────────────────────────────────────────────────

describe('loadForProject()', () => {
  it('populates conversations and sets status to ready on success', async () => {
    const conversations = [makeConversation({ title: 'A' }), makeConversation({ title: 'B' })]
    mockListConversations.mockResolvedValue(conversations)

    await useConversationStore.getState().loadForProject('proj-1')

    const state = useConversationStore.getState()
    expect(state.status).toBe('ready')
    expect(state.conversations).toEqual(conversations)
    expect(state.activeProjectId).toBe('proj-1')
  })

  it('replaces conversations when switching projects', async () => {
    mockListConversations.mockResolvedValue([makeConversation()])
    await useConversationStore.getState().loadForProject('proj-1')
    mockListConversations.mockResolvedValue([])
    await useConversationStore.getState().loadForProject('proj-2')

    const state = useConversationStore.getState()
    expect(state.conversations).toHaveLength(0)
    expect(state.activeProjectId).toBe('proj-2')
  })

  it('sets status to error on DB failure', async () => {
    mockListConversations.mockRejectedValue(new Error('db error'))

    await useConversationStore.getState().loadForProject('proj-1')

    const state = useConversationStore.getState()
    expect(state.status).toBe('error')
    expect(state.error).toContain('db error')
  })

  it('transitions through loading before resolving', async () => {
    const statuses: string[] = []
    const unsub = useConversationStore.subscribe((s) => statuses.push(s.status))
    mockListConversations.mockResolvedValue([])
    await useConversationStore.getState().loadForProject('proj-1')
    unsub()

    expect(statuses).toContain('loading')
    expect(statuses[statuses.length - 1]).toBe('ready')
  })
})

// ── create() ─────────────────────────────────────────────────────────────────

describe('create()', () => {
  it('inserts a conversation and prepends it to the list', async () => {
    const existing = makeConversation({ title: 'Old' })
    useConversationStore.setState({ conversations: [existing] })
    const newId = crypto.randomUUID()
    mockCreateConversation.mockResolvedValue(newId)

    const result = await useConversationStore.getState().create('proj-1')

    expect(result).not.toBeNull()
    expect(result!.id).toBe(newId)
    expect(result!.project_id).toBe('proj-1')
    const { conversations } = useConversationStore.getState()
    expect(conversations).toHaveLength(2)
    expect(conversations[0].id).toBe(newId)
  })

  it('new conversation has null title', async () => {
    mockCreateConversation.mockResolvedValue(crypto.randomUUID())

    const result = await useConversationStore.getState().create('proj-1')

    expect(result!.title).toBeNull()
  })

  it('returns null and pushes error notification on failure', async () => {
    mockCreateConversation.mockRejectedValue(new Error('write failed'))

    const result = await useConversationStore.getState().create('proj-1')

    expect(result).toBeNull()
    const { notifications } = useNotificationStore.getState()
    expect(notifications).toHaveLength(1)
    expect(notifications[0].kind).toBe('error')
  })
})

// ── rename() ─────────────────────────────────────────────────────────────────

describe('rename()', () => {
  it('sets operationStates to renaming during write, clears on success', async () => {
    const conv = makeConversation()
    useConversationStore.setState({ conversations: [conv] })
    const capturedStates: string[] = []

    mockUpdateConversation.mockImplementation(async () => {
      capturedStates.push(useConversationStore.getState().operationStates[conv.id] ?? 'none')
    })

    await useConversationStore.getState().rename(conv.id, 'Renamed')

    expect(capturedStates[0]).toBe('renaming')
    expect(useConversationStore.getState().operationStates[conv.id]).toBeUndefined()
  })

  it('updates title in store on success', async () => {
    const conv = makeConversation({ title: 'Old Title' })
    useConversationStore.setState({ conversations: [conv] })
    mockUpdateConversation.mockResolvedValue(undefined)

    await useConversationStore.getState().rename(conv.id, 'New Title')

    const updated = useConversationStore.getState().conversations.find((c) => c.id === conv.id)
    expect(updated?.title).toBe('New Title')
  })

  it('clears operationState and pushes notification on failure', async () => {
    const conv = makeConversation()
    useConversationStore.setState({ conversations: [conv] })
    mockUpdateConversation.mockRejectedValue(new Error('locked'))

    await useConversationStore.getState().rename(conv.id, 'Fail')

    expect(useConversationStore.getState().operationStates[conv.id]).toBeUndefined()
    expect(useNotificationStore.getState().notifications[0].kind).toBe('error')
  })

  it('ignores concurrent rename for the same id', async () => {
    const conv = makeConversation()
    useConversationStore.setState({
      conversations: [conv],
      operationStates: { [conv.id]: 'renaming' },
    })

    await useConversationStore.getState().rename(conv.id, 'Ignored')

    expect(mockUpdateConversation).not.toHaveBeenCalled()
  })
})

// ── delete() ─────────────────────────────────────────────────────────────────

describe('delete()', () => {
  it('sets operationStates to deleting during write, removes on success', async () => {
    const conv = makeConversation()
    useConversationStore.setState({ conversations: [conv] })
    const capturedStates: string[] = []

    mockDeleteConversation.mockImplementation(async () => {
      capturedStates.push(useConversationStore.getState().operationStates[conv.id] ?? 'none')
    })

    await useConversationStore.getState().delete(conv.id)

    expect(capturedStates[0]).toBe('deleting')
    expect(useConversationStore.getState().conversations).toHaveLength(0)
    expect(useConversationStore.getState().operationStates[conv.id]).toBeUndefined()
  })

  it('clears operationState and pushes notification on failure', async () => {
    const conv = makeConversation()
    useConversationStore.setState({ conversations: [conv] })
    mockDeleteConversation.mockRejectedValue(new Error('constraint'))

    await useConversationStore.getState().delete(conv.id)

    expect(useConversationStore.getState().conversations).toHaveLength(1)
    expect(useConversationStore.getState().operationStates[conv.id]).toBeUndefined()
    expect(useNotificationStore.getState().notifications[0].kind).toBe('error')
  })

  it('guards against concurrent deletes', async () => {
    const conv = makeConversation()
    useConversationStore.setState({
      conversations: [conv],
      operationStates: { [conv.id]: 'deleting' },
    })

    await useConversationStore.getState().delete(conv.id)

    expect(mockDeleteConversation).not.toHaveBeenCalled()
  })
})

// ── setActive() ───────────────────────────────────────────────────────────────

describe('setActive()', () => {
  it('updates activeConversationId', () => {
    useConversationStore.getState().setActive('chat-99')
    expect(useConversationStore.getState().activeConversationId).toBe('chat-99')
  })
})
