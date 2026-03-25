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
    artifact,
    headRevision: head ?? null,
    loadedRevisionId: head?.id ?? null,
    revisions,
    contentSwapRequest: null,
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
})

// ── Save chain ─────────────────────────────────────────────────────────────────

describe('save chain', () => {
  it('1: stale revisionId is silently discarded', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    // loadedRevisionId is 'rev-1', send a stale 'rev-old'
    await useArtifactStore.getState().save({ revisionId: 'rev-old', content: 'new' })
    expect(mockUpdateRevisionContent).not.toHaveBeenCalled()
  })

  it('2: isSaving guard prevents concurrent save', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    useArtifactStore.setState({ isSaving: true })
    await useArtifactStore.getState().save({ revisionId: 'rev-1', content: 'new' })
    expect(mockUpdateRevisionContent).not.toHaveBeenCalled()
  })

  it('3: _persistToHead updates content when HEAD is a user draft', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision({ message_id: null }) // draft
    seedStore(artifact, [rev])
    await useArtifactStore.getState().save({ revisionId: 'rev-1', content: 'updated' })
    expect(mockUpdateRevisionContent).toHaveBeenCalledWith('rev-1', 'updated')
  })

  it('4: _createDraftThenPersist creates new draft when HEAD is sealed', async () => {
    const artifact = makeArtifact()
    const sealedRev = makeRevision({ message_id: 'msg-1' }) // sealed
    seedStore(artifact, [sealedRev])
    mockCreateRevision.mockResolvedValue('rev-2')
    await useArtifactStore.getState().save({ revisionId: 'rev-1', content: 'forked' })
    expect(mockCreateRevision).toHaveBeenCalled()
    expect(mockUpdateArtifact).toHaveBeenCalledWith('art-1', { current_revision_id: 'rev-2' })
  })

  it('5: _createDraftFromOldRevision creates draft when editing non-HEAD revision', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const oldRev = makeRevision({ id: 'rev-1', message_id: 'msg-1' })
    const headRev = makeRevision({ id: 'rev-2', message_id: 'msg-2' })
    seedStore(artifact, [oldRev, headRev])
    // Simulate editor loaded the old revision
    useArtifactStore.setState({ loadedRevisionId: 'rev-1' })
    mockCreateRevision.mockResolvedValue('rev-3')
    await useArtifactStore.getState().save({ revisionId: 'rev-1', content: 'from old' })
    expect(mockCreateRevision).toHaveBeenCalled()
  })

  it('6: after draft creation loadedRevisionId is updated to new draft id', async () => {
    const artifact = makeArtifact()
    const sealedRev = makeRevision({ message_id: 'msg-1' })
    seedStore(artifact, [sealedRev])
    mockCreateRevision.mockResolvedValue('rev-new')
    await useArtifactStore.getState().save({ revisionId: 'rev-1', content: 'forked' })
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-new')
  })
})

// ── Seal chain ─────────────────────────────────────────────────────────────────

describe('sealForSend', () => {
  const makeSysMsgCreator = (id = 'sys-msg-1') => vi.fn(async () => id)

  it('1: isDraft && changed → _sealDraftInPlace — calls sysMsgCreator and seals revision with returned id', async () => {
    const artifact = makeArtifact()
    const draft = makeRevision({ content: 'new content', message_id: null })
    seedStore(artifact, [draft])
    const creator = makeSysMsgCreator('sys-1')
    const result = await useArtifactStore.getState().sealForSend(creator)
    expect(creator).toHaveBeenCalledWith('rev-1', 'user')
    expect(mockSealRevision).toHaveBeenCalledWith('rev-1', 'sys-1')
    expect(result?.revisionId).toBe('rev-1')
  })

  it('2: isDraft && !changed → _reuseLastSealed — sysMsgCreator NOT called', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const sealed = makeRevision({ id: 'rev-1', message_id: 'msg-old', content: 'base' })
    const draft = makeRevision({ id: 'rev-2', message_id: null, content: 'base' })
    seedStore(artifact, [sealed, draft])
    const creator = makeSysMsgCreator()
    const result = await useArtifactStore.getState().sealForSend(creator)
    expect(creator).not.toHaveBeenCalled()
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(result?.revisionId).toBe('rev-1')
  })

  it('3: !isDraft && changed → _createSealedRevision — calls sysMsgCreator, seals new revision', async () => {
    const artifactWithSealed = makeArtifact({ current_revision_id: 'rev-sealed2' })
    const sealedRev = makeRevision({ id: 'rev-sealed', message_id: 'msg-1', content: 'v1' })
    const sealedRev2 = makeRevision({ id: 'rev-sealed2', message_id: 'msg-2', content: 'v2' })
    seedStore(artifactWithSealed, [sealedRev, sealedRev2])
    useArtifactStore.setState({ headRevision: { ...sealedRev2, content: 'v3-different' } })
    mockCreateRevision.mockResolvedValue('rev-new-sealed')
    const creator = makeSysMsgCreator('sys-2')
    const result = await useArtifactStore.getState().sealForSend(creator)
    expect(creator).toHaveBeenCalledWith('rev-new-sealed', 'user')
    expect(mockSealRevision).toHaveBeenCalledWith('rev-new-sealed', 'sys-2')
    expect(result?.revisionId).toBe('rev-new-sealed')
  })

  it('4: !isDraft && !changed → _reuseCurrentHead — sysMsgCreator NOT called', async () => {
    const sealed = makeRevision({ message_id: 'msg-1', content: 'same' })
    const artifact = makeArtifact({ current_revision_id: 'rev-1' })
    seedStore(artifact, [sealed])
    const creator = makeSysMsgCreator()
    const result = await useArtifactStore.getState().sealForSend(creator)
    expect(creator).not.toHaveBeenCalled()
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(result?.revisionId).toBe('rev-1')
  })
})

// ── Lifecycle ──────────────────────────────────────────────────────────────────

describe('loadForConversation', () => {
  it('creates initial artifact and revision when none exist', async () => {
    mockListArtifacts.mockResolvedValue([])
    mockCreateArtifact.mockResolvedValue('art-new')
    mockCreateRevision.mockResolvedValue('rev-new')
    mockUpdateArtifact.mockResolvedValue(undefined)
    mockGetArtifact.mockResolvedValue(makeArtifact({ id: 'art-new', current_revision_id: 'rev-new' }))
    mockListRevisions.mockResolvedValue([makeRevision({ id: 'rev-new', artifact_id: 'art-new' })])

    await useArtifactStore.getState().loadForConversation('conv-1')

    expect(mockCreateArtifact).toHaveBeenCalled()
    expect(mockSetConversationActiveArtifact).toHaveBeenCalledWith('conv-1', 'art-new')
    expect(useArtifactStore.getState().artifact?.id).toBe('art-new')
  })

  it('loads existing artifact and sets contentSwapRequest', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    mockListArtifacts.mockResolvedValue([artifact])
    mockListRevisions.mockResolvedValue([rev])

    await useArtifactStore.getState().loadForConversation('conv-1')

    expect(useArtifactStore.getState().artifact?.id).toBe('art-1')
    expect(useArtifactStore.getState().contentSwapRequest?.revisionId).toBe('rev-1')
  })
})

describe('applyAiRevision', () => {
  it('inserts ai revision, calls sysMsgCreator with revisionId and "ai", seals revision, sets contentSwapRequest', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    mockCreateRevision.mockResolvedValue('rev-ai')
    const creator = vi.fn(async () => 'sys-ai')

    await useArtifactStore.getState().applyAiRevision('ai content', creator)

    expect(mockCreateRevision).toHaveBeenCalledWith(
      expect.objectContaining({ author: 'ai' })
    )
    expect(creator).toHaveBeenCalledWith('rev-ai', 'ai')
    expect(mockSealRevision).toHaveBeenCalledWith('rev-ai', 'sys-ai')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe('sys-ai')
    expect(useArtifactStore.getState().contentSwapRequest?.revisionId).toBe('rev-ai')
  })
})

describe('requestRevisionLoad', () => {
  it('sets contentSwapRequest without changing current_revision_id', () => {
    const artifact = makeArtifact()
    const rev1 = makeRevision({ id: 'rev-1', content: 'v1', message_id: 'msg-1' })
    const rev2 = makeRevision({ id: 'rev-2', content: 'v2', message_id: null })
    seedStore(artifact, [rev1, rev2])

    useArtifactStore.getState().requestRevisionLoad('rev-1')

    const { contentSwapRequest, artifact: a } = useArtifactStore.getState()
    expect(contentSwapRequest?.revisionId).toBe('rev-1')
    expect(contentSwapRequest?.content).toBe('v1')
    expect(a?.current_revision_id).toBe('rev-1') // unchanged from seed
  })
})

describe('acknowledgeSwap', () => {
  it('clears contentSwapRequest', () => {
    useArtifactStore.setState({ contentSwapRequest: { revisionId: 'rev-1', content: 'x' } })
    useArtifactStore.getState().acknowledgeSwap()
    expect(useArtifactStore.getState().contentSwapRequest).toBeNull()
  })
})

describe('createNewArtifact', () => {
  it('creates artifact and empty user-draft revision, updates active_artifact_id', async () => {
    mockCreateArtifact.mockResolvedValue('art-new')
    mockCreateRevision.mockResolvedValue('rev-new')
    mockUpdateArtifact.mockResolvedValue(undefined)
    mockGetArtifact.mockResolvedValue(makeArtifact({ id: 'art-new', current_revision_id: 'rev-new' }))

    await useArtifactStore.getState().createNewArtifact('conv-1')

    expect(mockSetConversationActiveArtifact).toHaveBeenCalledWith('conv-1', 'art-new')
    expect(useArtifactStore.getState().contentSwapRequest?.content).toBe('')
  })
})

// ── Revision system message integration ───────────────────────────────────────

describe('system message integration — send flow', () => {
  it('9.9: user sends with changed content — sysMsgCreator called, revision sealed to system msg id', async () => {
    const artifact = makeArtifact()
    const draft = makeRevision({ content: 'edited content', message_id: null })
    seedStore(artifact, [draft])
    const creator = vi.fn(async () => 'sys-msg-new')

    const result = await useArtifactStore.getState().sealForSend(creator)

    expect(creator).toHaveBeenCalledWith('rev-1', 'user')
    expect(mockSealRevision).toHaveBeenCalledWith('rev-1', 'sys-msg-new')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe('sys-msg-new')
    expect(result?.revisionId).toBe('rev-1')
  })

  it('9.10: user sends without changes — sysMsgCreator NOT called, no new revision', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const sealed = makeRevision({ id: 'rev-1', message_id: 'sys-old', content: 'same' })
    const draft = makeRevision({ id: 'rev-2', message_id: null, content: 'same' })
    seedStore(artifact, [sealed, draft])
    const creator = vi.fn(async () => 'sys-never')

    await useArtifactStore.getState().sealForSend(creator)

    expect(creator).not.toHaveBeenCalled()
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
  })

  it('9.11: AI responds with artifact content — sysMsgCreator called with "ai", revision sealed', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    mockCreateRevision.mockResolvedValue('rev-ai-new')
    const creator = vi.fn(async () => 'sys-ai')

    await useArtifactStore.getState().applyAiRevision('AI wrote this', creator)

    expect(creator).toHaveBeenCalledWith('rev-ai-new', 'ai')
    expect(mockSealRevision).toHaveBeenCalledWith('rev-ai-new', 'sys-ai')
    expect(useArtifactStore.getState().headRevision?.author).toBe('ai')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe('sys-ai')
  })

  it('9.12: initial draft revision has message_id=null — no system message at creation', async () => {
    // loadForConversation creates an initial draft — no sealRevision called, no system message
    mockListArtifacts.mockResolvedValue([])
    mockCreateArtifact.mockResolvedValue('art-new')
    mockCreateRevision.mockResolvedValue('rev-draft')
    mockGetArtifact.mockResolvedValue(makeArtifact({ id: 'art-new', current_revision_id: 'rev-draft' }))
    mockListRevisions.mockResolvedValue([makeRevision({ id: 'rev-draft', artifact_id: 'art-new', message_id: null })])

    await useArtifactStore.getState().loadForConversation('conv-new')

    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().headRevision?.message_id).toBeNull()
  })
})
