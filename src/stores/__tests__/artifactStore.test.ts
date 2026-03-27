import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Artifact, ArtifactRevision } from '@/lib/db/types'

// ── Mock Tauri invoke ──────────────────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => null),
}))

// ── Mock repositories ──────────────────────────────────────────────────────────

const mockListArtifacts = vi.fn<() => Promise<Artifact[]>>()
const mockCreateArtifact = vi.fn<() => Promise<string>>()
const mockGetArtifact = vi.fn<() => Promise<Artifact | null>>()
const mockUpdateArtifact = vi.fn<() => Promise<void>>()

vi.mock('@/lib/db/repositories/documents', () => ({
  listArtifacts: () => mockListArtifacts(),
  createArtifact: (...args: unknown[]) => mockCreateArtifact(...args),
  getArtifact: (...args: unknown[]) => mockGetArtifact(...args),
  updateArtifact: (...args: unknown[]) => mockUpdateArtifact(...args),
}))

const mockCreateRevision = vi.fn<() => Promise<string>>()
const mockListRevisions = vi.fn<() => Promise<ArtifactRevision[]>>()
const mockUpdateRevisionContent = vi.fn<() => Promise<void>>()
const mockSealRevision = vi.fn<() => Promise<void>>()

vi.mock('@/lib/db/repositories/revisions', () => ({
  createRevision: (...args: unknown[]) => mockCreateRevision(...args),
  listRevisions: () => mockListRevisions(),
  updateRevisionContent: (...args: unknown[]) => mockUpdateRevisionContent(...args),
  sealRevision: (...args: unknown[]) => mockSealRevision(...args),
}))

const mockSetConversationActiveArtifact = vi.fn<() => Promise<void>>()

vi.mock('@/lib/db/repositories/conversations', () => ({
  setConversationActiveArtifact: (...args: unknown[]) =>
    mockSetConversationActiveArtifact(...args),
}))

// ── Mock message store ─────────────────────────────────────────────────────────

const mockAddSystemRevisionMessage = vi.fn<() => Promise<string>>()

vi.mock('@/stores/messageStore', () => ({
  useMessageStore: {
    getState: () => ({
      messages: [],
      addSystemRevisionMessage: mockAddSystemRevisionMessage,
    }),
  },
}))

// ── Import after mocks ─────────────────────────────────────────────────────────

import { useArtifactStore } from '../artifactStore'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'art-1',
    conversation_id: 'conv-1',
    title: null,
    current_revision_id: 'rev-1',
    file_path: null,
    file_hash: null,
    created_at: 1000,
    updated_at: 1000,
    ...overrides,
  }
}

function makeRevision(overrides: Partial<ArtifactRevision> = {}): ArtifactRevision {
  return {
    id: 'rev-1',
    artifact_id: 'art-1',
    message_id: null,
    author: 'user',
    content: 'initial',
    created_at: 1000,
    updated_at: 1000,
    ...overrides,
  }
}

function seedStore(artifact: Artifact, revisions: ArtifactRevision[]) {
  const head = revisions.find((r) => r.id === artifact.current_revision_id) ?? revisions[0]
  useArtifactStore.setState({
    status: 'ready',
    artifact,
    headRevision: head ?? null,
    activeRevisionId: head?.id ?? null,
    loadedContent: head?.content ?? '',
    editorKey: head?.id ?? 'seed',
    revisions,
    isSaving: false,
    saveError: null,
    externalChangeDetected: false,
  })
}

// ── Reset store between tests ──────────────────────────────────────────────────

beforeEach(() => {
  useArtifactStore.getState().reset()
  vi.clearAllMocks()
  mockUpdateArtifact.mockResolvedValue(undefined)
  mockUpdateRevisionContent.mockResolvedValue(undefined)
  mockSealRevision.mockResolvedValue(undefined)
  mockSetConversationActiveArtifact.mockResolvedValue(undefined)
  mockAddSystemRevisionMessage.mockResolvedValue('sys-msg-1')
})

// ── Save chain ─────────────────────────────────────────────────────────────────

describe('save chain', () => {
  it('1: save is dropped when status is not ready', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    useArtifactStore.setState({ status: 'loading' })
    await useArtifactStore.getState().save('new content')
    expect(mockUpdateRevisionContent).not.toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
  })

  it('2: isSaving guard prevents concurrent save', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    useArtifactStore.setState({ isSaving: true })
    await useArtifactStore.getState().save('new content')
    expect(mockUpdateRevisionContent).not.toHaveBeenCalled()
  })

  it('3: _persistToHead updates content when HEAD is a user draft', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision({ message_id: null }) // draft
    seedStore(artifact, [rev])
    await useArtifactStore.getState().save('updated')
    expect(mockUpdateRevisionContent).toHaveBeenCalledWith('rev-1', 'updated')
  })

  it('4: _createDraftThenPersist creates new draft when HEAD is sealed', async () => {
    const artifact = makeArtifact()
    const sealedRev = makeRevision({ message_id: 'msg-1' }) // sealed
    seedStore(artifact, [sealedRev])
    mockCreateRevision.mockResolvedValue('rev-2')
    await useArtifactStore.getState().save('forked')
    expect(mockCreateRevision).toHaveBeenCalled()
    expect(mockUpdateArtifact).toHaveBeenCalledWith('art-1', { current_revision_id: 'rev-2' })
  })

  it('5: null activeRevisionId creates a new user-draft revision', async () => {
    const artifact = makeArtifact({ current_revision_id: null })
    seedStore(artifact, [])
    useArtifactStore.setState({ activeRevisionId: null, headRevision: null })
    mockCreateRevision.mockResolvedValue('rev-first')
    await useArtifactStore.getState().save('first content')
    expect(mockCreateRevision).toHaveBeenCalled()
    expect(useArtifactStore.getState().activeRevisionId).toBe('rev-first')
  })

  it('6: after draft creation activeRevisionId is updated to new draft id', async () => {
    const artifact = makeArtifact()
    const sealedRev = makeRevision({ message_id: 'msg-1' })
    seedStore(artifact, [sealedRev])
    mockCreateRevision.mockResolvedValue('rev-new')
    await useArtifactStore.getState().save('forked')
    expect(useArtifactStore.getState().activeRevisionId).toBe('rev-new')
  })
})

// ── Seal chain ─────────────────────────────────────────────────────────────────

describe('sealForSend', () => {
  it('1: isDraft && changed → _sealDraftInPlace — creates system message and seals revision', async () => {
    const artifact = makeArtifact()
    const draft = makeRevision({ content: 'new content', message_id: null })
    seedStore(artifact, [draft])
    mockAddSystemRevisionMessage.mockResolvedValue('sys-1')
    const result = await useArtifactStore.getState().sealForSend()
    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith('user', 'art-1', 'rev-1')
    expect(mockSealRevision).toHaveBeenCalledWith('rev-1', 'sys-1')
    expect(result?.revisionId).toBe('rev-1')
  })

  it('2: isDraft && !changed → _reuseLastSealed — no system message created', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const sealed = makeRevision({ id: 'rev-1', message_id: 'msg-old', content: 'base' })
    const draft = makeRevision({ id: 'rev-2', message_id: null, content: 'base' })
    seedStore(artifact, [sealed, draft])
    const result = await useArtifactStore.getState().sealForSend()
    expect(mockAddSystemRevisionMessage).not.toHaveBeenCalled()
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(result?.revisionId).toBe('rev-1')
  })

  it('3: !isDraft && changed → _createSealedRevision — creates system message, seals new revision', async () => {
    const artifactWithSealed = makeArtifact({ current_revision_id: 'rev-sealed2' })
    const sealedRev = makeRevision({ id: 'rev-sealed', message_id: 'msg-1', content: 'v1' })
    const sealedRev2 = makeRevision({ id: 'rev-sealed2', message_id: 'msg-2', content: 'v2' })
    seedStore(artifactWithSealed, [sealedRev, sealedRev2])
    useArtifactStore.setState({ headRevision: { ...sealedRev2, content: 'v3-different' } })
    mockCreateRevision.mockResolvedValue('rev-new-sealed')
    mockAddSystemRevisionMessage.mockResolvedValue('sys-2')
    const result = await useArtifactStore.getState().sealForSend()
    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith('user', 'art-1', 'rev-new-sealed')
    expect(mockSealRevision).toHaveBeenCalledWith('rev-new-sealed', 'sys-2')
    expect(result?.revisionId).toBe('rev-new-sealed')
  })

  it('4: !isDraft && !changed → _reuseCurrentHead — no system message created', async () => {
    const sealed = makeRevision({ message_id: 'msg-1', content: 'same' })
    const artifact = makeArtifact({ current_revision_id: 'rev-1' })
    seedStore(artifact, [sealed])
    const result = await useArtifactStore.getState().sealForSend()
    expect(mockAddSystemRevisionMessage).not.toHaveBeenCalled()
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(result?.revisionId).toBe('rev-1')
  })
})

// ── Lifecycle ──────────────────────────────────────────────────────────────────

describe('loadForConversation', () => {
  it('creates artifact only (no revision) when none exist', async () => {
    mockListArtifacts.mockResolvedValue([])
    mockCreateArtifact.mockResolvedValue('art-new')
    mockGetArtifact.mockResolvedValue(makeArtifact({ id: 'art-new', current_revision_id: null }))
    mockListRevisions.mockResolvedValue([])

    await useArtifactStore.getState().loadForConversation('conv-1')

    expect(mockCreateArtifact).toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(mockSetConversationActiveArtifact).toHaveBeenCalledWith('conv-1', 'art-new')
    expect(useArtifactStore.getState().artifact?.id).toBe('art-new')
    expect(useArtifactStore.getState().activeRevisionId).toBeNull()
    expect(useArtifactStore.getState().headRevision).toBeNull()
  })

  it('loads existing artifact and sets activeRevisionId', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    mockListArtifacts.mockResolvedValue([artifact])
    mockListRevisions.mockResolvedValue([rev])

    await useArtifactStore.getState().loadForConversation('conv-1')

    expect(useArtifactStore.getState().artifact?.id).toBe('art-1')
    expect(useArtifactStore.getState().activeRevisionId).toBe('rev-1')
  })
})

describe('applyAiRevision', () => {
  it('inserts ai revision, creates system message with "ai", seals revision, sets activeRevisionId', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    mockCreateRevision.mockResolvedValue('rev-ai')
    mockAddSystemRevisionMessage.mockResolvedValue('sys-ai')

    await useArtifactStore.getState().applyAiRevision('ai content')

    expect(mockCreateRevision).toHaveBeenCalledWith(
      expect.objectContaining({ author: 'ai' })
    )
    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith('ai', 'art-1', 'rev-ai')
    expect(mockSealRevision).toHaveBeenCalledWith('rev-ai', 'sys-ai')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe('sys-ai')
    expect(useArtifactStore.getState().activeRevisionId).toBe('rev-ai')
  })
})

describe('requestRevisionLoad', () => {
  it('loading head revision keeps activeRevisionId pointing to head', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const rev1 = makeRevision({ id: 'rev-1', content: 'v1', message_id: 'msg-1' })
    const rev2 = makeRevision({ id: 'rev-2', content: 'v2', message_id: null })
    seedStore(artifact, [rev1, rev2])

    await useArtifactStore.getState().requestRevisionLoad('rev-2')

    expect(useArtifactStore.getState().activeRevisionId).toBe('rev-2')
    expect(useArtifactStore.getState().loadedContent).toBe('v2')
    expect(useArtifactStore.getState().status).toBe('ready')
  })

  it('loading non-head revision sets activeRevisionId to null (detaches for new draft on edit)', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const rev1 = makeRevision({ id: 'rev-1', content: 'v1', message_id: 'msg-1' })
    const rev2 = makeRevision({ id: 'rev-2', content: 'v2', message_id: null })
    seedStore(artifact, [rev1, rev2])

    await useArtifactStore.getState().requestRevisionLoad('rev-1')

    expect(useArtifactStore.getState().activeRevisionId).toBeNull()
    expect(useArtifactStore.getState().loadedContent).toBe('v1')
    expect(useArtifactStore.getState().status).toBe('ready')
  })
})

describe('createNewArtifact', () => {
  it('creates artifact with no revision, sets activeRevisionId to null', async () => {
    mockCreateArtifact.mockResolvedValue('art-new')
    mockGetArtifact.mockResolvedValue(makeArtifact({ id: 'art-new', current_revision_id: null }))

    await useArtifactStore.getState().createNewArtifact('conv-1')

    expect(mockSetConversationActiveArtifact).toHaveBeenCalledWith('conv-1', 'art-new')
    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().activeRevisionId).toBeNull()
    expect(useArtifactStore.getState().headRevision).toBeNull()
  })
})

// ── Revision system message integration ───────────────────────────────────────

describe('system message integration — send flow', () => {
  it('9.9: user sends with changed content — system message created, revision sealed', async () => {
    const artifact = makeArtifact()
    const draft = makeRevision({ content: 'edited content', message_id: null })
    seedStore(artifact, [draft])
    mockAddSystemRevisionMessage.mockResolvedValue('sys-msg-new')

    const result = await useArtifactStore.getState().sealForSend()

    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith('user', 'rev-1')
    expect(mockSealRevision).toHaveBeenCalledWith('rev-1', 'sys-msg-new')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe('sys-msg-new')
    expect(result?.revisionId).toBe('rev-1')
  })

  it('9.10: user sends without changes — no system message, no new revision', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const sealed = makeRevision({ id: 'rev-1', message_id: 'sys-old', content: 'same' })
    const draft = makeRevision({ id: 'rev-2', message_id: null, content: 'same' })
    seedStore(artifact, [sealed, draft])

    await useArtifactStore.getState().sealForSend()

    expect(mockAddSystemRevisionMessage).not.toHaveBeenCalled()
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
  })

  it('9.11: AI responds with artifact content — system message created with "ai", revision sealed', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    mockCreateRevision.mockResolvedValue('rev-ai-new')
    mockAddSystemRevisionMessage.mockResolvedValue('sys-ai')

    await useArtifactStore.getState().applyAiRevision('AI wrote this')

    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith('ai', 'rev-ai-new')
    expect(mockSealRevision).toHaveBeenCalledWith('rev-ai-new', 'sys-ai')
    expect(useArtifactStore.getState().headRevision?.author).toBe('ai')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe('sys-ai')
  })

  it('9.12: new empty document has no revision and no system message', async () => {
    mockListArtifacts.mockResolvedValue([])
    mockCreateArtifact.mockResolvedValue('art-new')
    mockGetArtifact.mockResolvedValue(makeArtifact({ id: 'art-new', current_revision_id: null }))
    mockListRevisions.mockResolvedValue([])

    await useArtifactStore.getState().loadForConversation('conv-new')

    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().headRevision).toBeNull()
  })
})
