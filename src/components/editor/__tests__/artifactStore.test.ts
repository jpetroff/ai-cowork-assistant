import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Artifact, ArtifactRevision, Conversation } from '@/lib/db/types'

// ── Mock Tauri invoke ──────────────────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => null),
}))

// ── Mock repositories ──────────────────────────────────────────────────────────

const mockListArtifacts = vi.fn<() => Promise<Artifact[]>>()
const mockCreateArtifact = vi.fn<(...args: unknown[]) => Promise<string>>()
const mockGetArtifact =
  vi.fn<(...args: unknown[]) => Promise<Artifact | null>>()
const mockUpdateArtifact = vi.fn<(...args: unknown[]) => Promise<void>>()

vi.mock('@/lib/db/repositories/documents', () => ({
  listArtifacts: () => mockListArtifacts(),
  createArtifact: (...args: unknown[]) => mockCreateArtifact(...args),
  getArtifact: (...args: unknown[]) => mockGetArtifact(...args),
  updateArtifact: (...args: unknown[]) => mockUpdateArtifact(...args),
}))

const mockCreateRevision = vi.fn<(...args: unknown[]) => Promise<string>>()
const mockGetRevision =
  vi.fn<(...args: unknown[]) => Promise<ArtifactRevision | null>>()
const mockListRevisions =
  vi.fn<(...args: unknown[]) => Promise<ArtifactRevision[]>>()
const mockUpdateRevisionContent = vi.fn<(...args: unknown[]) => Promise<void>>()
const mockSealRevision = vi.fn<(...args: unknown[]) => Promise<void>>()

vi.mock('@/lib/db/repositories/revisions', () => ({
  createRevision: (...args: unknown[]) => mockCreateRevision(...args),
  getRevision: (...args: unknown[]) => mockGetRevision(...args),
  listRevisions: (...args: unknown[]) => mockListRevisions(...args),
  updateRevisionContent: (...args: unknown[]) =>
    mockUpdateRevisionContent(...args),
  sealRevision: (...args: unknown[]) => mockSealRevision(...args),
}))

const mockGetConversation =
  vi.fn<(...args: unknown[]) => Promise<Conversation | null>>()
const mockSetConversationActiveArtifact =
  vi.fn<(...args: unknown[]) => Promise<void>>()

vi.mock('@/lib/db/repositories/conversations', () => ({
  getConversation: (...args: unknown[]) => mockGetConversation(...args),
  setConversationActiveArtifact: (...args: unknown[]) =>
    mockSetConversationActiveArtifact(...args),
}))

// ── Mock revision message coordinator ─────────────────────────────────────────

const mockAddSystemRevisionMessage =
  vi.fn<
    (
      author: 'user' | 'ai',
      artifactId: string,
      revisionId: string
    ) => Promise<string>
  >()

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

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    project_id: 'proj-1',
    title: null,
    active_artifact_id: 'art-1',
    created_at: 1000,
    updated_at: 1000,
    ...overrides,
  }
}

function makeRevision(
  overrides: Partial<ArtifactRevision> = {}
): ArtifactRevision {
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
  const head =
    revisions.find((r) => r.id === artifact.current_revision_id) ?? revisions[0]
  useArtifactStore.setState({
    status: 'ready',
    artifact,
    headRevision: head ?? null,
    loadedRevisionId: head?.id ?? null,
    editableRevisionId: head?.id ?? null,
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
  mockGetRevision.mockResolvedValue(null)
  mockGetConversation.mockResolvedValue(makeConversation())
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
    expect(mockUpdateArtifact).toHaveBeenCalledWith('art-1', {
      current_revision_id: 'rev-2',
    })
  })

  it('5: null editableRevisionId creates a new user-draft revision', async () => {
    const artifact = makeArtifact({ current_revision_id: null })
    seedStore(artifact, [])
    useArtifactStore.setState({
      loadedRevisionId: null,
      editableRevisionId: null,
      headRevision: null,
    })
    mockCreateRevision.mockResolvedValue('rev-first')
    await useArtifactStore.getState().save('first content')
    expect(mockCreateRevision).toHaveBeenCalled()
    expect(mockAddSystemRevisionMessage).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-first')
    expect(useArtifactStore.getState().editableRevisionId).toBe('rev-first')
  })

  it('creates a new user draft instead of editing an unsealed AI revision in place', async () => {
    const artifact = makeArtifact()
    const aiRevision = makeRevision({ author: 'ai', message_id: null })
    seedStore(artifact, [aiRevision])
    mockCreateRevision.mockResolvedValue('rev-user-draft')

    await useArtifactStore.getState().save('user edit')

    expect(mockUpdateRevisionContent).not.toHaveBeenCalled()
    expect(mockCreateRevision).toHaveBeenCalledWith(
      expect.objectContaining({ author: 'user', content: 'user edit' })
    )
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-user-draft')
    expect(useArtifactStore.getState().editableRevisionId).toBe(
      'rev-user-draft'
    )
  })

  it('6: after draft creation loaded/editable ids are updated to new draft id', async () => {
    const artifact = makeArtifact()
    const sealedRev = makeRevision({ message_id: 'msg-1' })
    seedStore(artifact, [sealedRev])
    mockCreateRevision.mockResolvedValue('rev-new')
    await useArtifactStore.getState().save('forked')
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-new')
    expect(useArtifactStore.getState().editableRevisionId).toBe('rev-new')
  })

  it('creates a new draft when saving from a loaded historical revision', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const rev1 = makeRevision({
      id: 'rev-1',
      content: 'historical',
      message_id: 'msg-1',
    })
    const rev2 = makeRevision({
      id: 'rev-2',
      content: 'head',
      message_id: null,
    })
    seedStore(artifact, [rev1, rev2])
    useArtifactStore.setState({
      loadedRevisionId: 'rev-1',
      editableRevisionId: null,
      loadedContent: 'historical',
      editorKey: 'fresh-draft-id',
    })
    mockCreateRevision.mockResolvedValue('rev-from-history')

    await useArtifactStore.getState().save('historical edit')

    expect(mockCreateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        author: 'user',
        content: 'historical edit',
      })
    )
    expect(useArtifactStore.getState().loadedRevisionId).toBe(
      'rev-from-history'
    )
    expect(useArtifactStore.getState().editableRevisionId).toBe(
      'rev-from-history'
    )
  })
})

// ── Seal chain ─────────────────────────────────────────────────────────────────

describe('sealForSend', () => {
  it('1: isDraft && changed → _sealDraftInPlace — creates system message and seals revision', async () => {
    const artifact = makeArtifact()
    const draft = makeRevision({ content: 'new content', message_id: null })
    seedStore(artifact, [draft])
    mockAddSystemRevisionMessage.mockResolvedValue('sys-1')
    const result = await useArtifactStore
      .getState()
      .sealForSend(mockAddSystemRevisionMessage)
    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith(
      'user',
      'art-1',
      'rev-1'
    )
    expect(mockSealRevision).toHaveBeenCalledWith('rev-1', 'sys-1')
    expect(result?.revisionId).toBe('rev-1')
  })

  it('2: isDraft && !changed → _reuseLastSealed — no system message created', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const sealed = makeRevision({
      id: 'rev-1',
      message_id: 'msg-old',
      content: 'base',
    })
    const draft = makeRevision({
      id: 'rev-2',
      message_id: null,
      content: 'base',
    })
    seedStore(artifact, [sealed, draft])
    const result = await useArtifactStore
      .getState()
      .sealForSend(mockAddSystemRevisionMessage)
    expect(mockAddSystemRevisionMessage).not.toHaveBeenCalled()
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(result?.revisionId).toBe('rev-1')
  })

  it('3: !isDraft && changed → _createSealedRevision — creates system message, seals new revision', async () => {
    const artifactWithSealed = makeArtifact({
      current_revision_id: 'rev-sealed2',
    })
    const sealedRev = makeRevision({
      id: 'rev-sealed',
      message_id: 'msg-1',
      content: 'v1',
    })
    const sealedRev2 = makeRevision({
      id: 'rev-sealed2',
      message_id: 'msg-2',
      content: 'v2',
    })
    seedStore(artifactWithSealed, [sealedRev, sealedRev2])
    useArtifactStore.setState({
      headRevision: { ...sealedRev2, content: 'v3-different' },
    })
    mockCreateRevision.mockResolvedValue('rev-new-sealed')
    mockAddSystemRevisionMessage.mockResolvedValue('sys-2')
    const result = await useArtifactStore
      .getState()
      .sealForSend(mockAddSystemRevisionMessage)
    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith(
      'user',
      'art-1',
      'rev-new-sealed'
    )
    expect(mockSealRevision).toHaveBeenCalledWith('rev-new-sealed', 'sys-2')
    expect(result?.revisionId).toBe('rev-new-sealed')
  })

  it('4: !isDraft && !changed → _reuseCurrentHead — no system message created', async () => {
    const sealed = makeRevision({ message_id: 'msg-1', content: 'same' })
    const artifact = makeArtifact({ current_revision_id: 'rev-1' })
    seedStore(artifact, [sealed])
    const result = await useArtifactStore
      .getState()
      .sealForSend(mockAddSystemRevisionMessage)
    expect(mockAddSystemRevisionMessage).not.toHaveBeenCalled()
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(result?.revisionId).toBe('rev-1')
  })

  it('returns the loaded historical revision when the editor is detached from head', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const historical = makeRevision({
      id: 'rev-1',
      message_id: 'msg-1',
      content: 'historical content',
    })
    const head = makeRevision({
      id: 'rev-2',
      message_id: 'msg-2',
      content: 'head content',
    })
    seedStore(artifact, [historical, head])
    useArtifactStore.setState({
      loadedRevisionId: 'rev-1',
      editableRevisionId: null,
    })

    const result = await useArtifactStore
      .getState()
      .sealForSend(mockAddSystemRevisionMessage)

    expect(mockAddSystemRevisionMessage).not.toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(result).toEqual({
      artifactId: 'art-1',
      revisionId: 'rev-1',
      content: 'historical content',
    })
  })
})

// ── Lifecycle ──────────────────────────────────────────────────────────────────

describe('loadForConversation', () => {
  it('creates artifact only (no revision) when none exist', async () => {
    mockListArtifacts.mockResolvedValue([])
    mockCreateArtifact.mockResolvedValue('art-new')
    mockGetArtifact.mockResolvedValue(
      makeArtifact({ id: 'art-new', current_revision_id: null })
    )
    mockListRevisions.mockResolvedValue([])

    await useArtifactStore.getState().loadForConversation('conv-1')

    expect(mockCreateArtifact).toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(mockSetConversationActiveArtifact).toHaveBeenCalledWith(
      'conv-1',
      'art-new'
    )
    expect(useArtifactStore.getState().artifact?.id).toBe('art-new')
    expect(useArtifactStore.getState().loadedRevisionId).toBeNull()
    expect(useArtifactStore.getState().editableRevisionId).toBeNull()
    expect(useArtifactStore.getState().headRevision).toBeNull()
  })

  it('loads existing artifact and sets loaded/editable revision ids', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    mockListArtifacts.mockResolvedValue([artifact])
    mockListRevisions.mockResolvedValue([rev])

    await useArtifactStore.getState().loadForConversation('conv-1')

    expect(useArtifactStore.getState().artifact?.id).toBe('art-1')
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-1')
    expect(useArtifactStore.getState().editableRevisionId).toBe('rev-1')
  })

  it('honors conversations.active_artifact_id before updated_at fallback', async () => {
    const activeArtifact = makeArtifact({
      id: 'art-active',
      current_revision_id: 'rev-active',
      updated_at: 1000,
    })
    const newerArtifact = makeArtifact({
      id: 'art-newer',
      current_revision_id: 'rev-newer',
      updated_at: 2000,
    })
    const activeRevision = makeRevision({
      id: 'rev-active',
      artifact_id: 'art-active',
      content: 'active doc',
    })
    mockGetConversation.mockResolvedValue(
      makeConversation({ active_artifact_id: 'art-active' })
    )
    mockListArtifacts.mockResolvedValue([newerArtifact, activeArtifact])
    mockListRevisions.mockResolvedValue([activeRevision])

    await useArtifactStore.getState().loadForConversation('conv-1')

    expect(mockListRevisions).toHaveBeenCalledWith('art-active')
    expect(useArtifactStore.getState().artifact?.id).toBe('art-active')
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-active')
  })
})

describe('applyAiRevision', () => {
  it('inserts ai revision, creates system message with "ai", seals revision, sets loaded/editable ids', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    mockCreateRevision.mockResolvedValue('rev-ai')
    mockAddSystemRevisionMessage.mockResolvedValue('sys-ai')

    await useArtifactStore
      .getState()
      .applyAiRevision('ai content', mockAddSystemRevisionMessage)

    expect(mockCreateRevision).toHaveBeenCalledWith(
      expect.objectContaining({ author: 'ai' })
    )
    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith(
      'ai',
      'art-1',
      'rev-ai'
    )
    expect(mockSealRevision).toHaveBeenCalledWith('rev-ai', 'sys-ai')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe('sys-ai')
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-ai')
    expect(useArtifactStore.getState().editableRevisionId).toBe('rev-ai')
  })
})

describe('requestRevisionLoad', () => {
  it('loading head revision keeps loaded/editable ids pointing to head', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const rev1 = makeRevision({
      id: 'rev-1',
      content: 'v1',
      message_id: 'msg-1',
    })
    const rev2 = makeRevision({ id: 'rev-2', content: 'v2', message_id: null })
    seedStore(artifact, [rev1, rev2])

    await useArtifactStore.getState().requestRevisionLoad('rev-2')

    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-2')
    expect(useArtifactStore.getState().editableRevisionId).toBe('rev-2')
    expect(useArtifactStore.getState().loadedContent).toBe('v2')
    expect(useArtifactStore.getState().status).toBe('ready')
  })

  it('loading non-head revision keeps it loaded but detaches editing for a new draft', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const rev1 = makeRevision({
      id: 'rev-1',
      content: 'v1',
      message_id: 'msg-1',
    })
    const rev2 = makeRevision({ id: 'rev-2', content: 'v2', message_id: null })
    seedStore(artifact, [rev1, rev2])

    await useArtifactStore.getState().requestRevisionLoad('rev-1')

    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-1')
    expect(useArtifactStore.getState().editableRevisionId).toBeNull()
    expect(useArtifactStore.getState().loadedContent).toBe('v1')
    expect(useArtifactStore.getState().status).toBe('ready')
  })

  it('loading a revision from another artifact persists that artifact as active', async () => {
    const currentArtifact = makeArtifact({ id: 'art-current' })
    const currentRevision = makeRevision({
      id: 'rev-current',
      artifact_id: 'art-current',
    })
    const targetArtifact = makeArtifact({
      id: 'art-target',
      current_revision_id: 'rev-target',
    })
    const targetRevision = makeRevision({
      id: 'rev-target',
      artifact_id: 'art-target',
      content: 'target content',
    })
    seedStore(currentArtifact, [currentRevision])
    mockGetRevision.mockResolvedValue(targetRevision)
    mockGetArtifact.mockResolvedValue(targetArtifact)
    mockListRevisions.mockResolvedValue([targetRevision])

    await useArtifactStore.getState().requestRevisionLoad('rev-target')

    expect(mockSetConversationActiveArtifact).toHaveBeenCalledWith(
      'conv-1',
      'art-target'
    )
    expect(useArtifactStore.getState().artifact?.id).toBe('art-target')
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-target')
    expect(useArtifactStore.getState().editableRevisionId).toBe('rev-target')
  })
})

describe('artifact revision metadata cache', () => {
  it('loads thread metadata for revisions outside the active artifact', async () => {
    const currentArtifact = makeArtifact({
      id: 'art-current',
      title: 'Current Document',
    })
    const currentRevision = makeRevision({
      id: 'rev-current',
      artifact_id: 'art-current',
    })
    const targetArtifact = makeArtifact({
      id: 'art-target',
      title: 'Target Document',
      current_revision_id: 'rev-target',
    })
    const targetRevision = makeRevision({
      id: 'rev-target',
      artifact_id: 'art-target',
      content: 'target content',
    })
    seedStore(currentArtifact, [currentRevision])
    mockGetRevision.mockResolvedValue(targetRevision)
    mockGetArtifact.mockResolvedValue(targetArtifact)

    await useArtifactStore
      .getState()
      .loadArtifactRevisionMetas([
        { artifactId: 'art-target', revisionId: 'rev-target' },
      ])

    const meta = useArtifactStore
      .getState()
      .getArtifactRevisionMeta('art-target', { revisionId: 'rev-target' })
    expect(mockGetRevision).toHaveBeenCalledWith('rev-target')
    expect(mockGetArtifact).toHaveBeenCalledWith('art-target')
    expect(meta?.artifact.title).toBe('Target Document')
    expect(meta?.revision.id).toBe('rev-target')
    expect('content' in (meta?.revision ?? {})).toBe(false)
  })

  it('skips database reads for cached thread metadata', async () => {
    const artifact = makeArtifact({ title: 'Cached Document' })
    const revision = makeRevision()
    seedStore(artifact, [revision])

    await useArtifactStore
      .getState()
      .loadArtifactRevisionMetas([{ artifactId: 'art-1', revisionId: 'rev-1' }])

    expect(mockGetRevision).not.toHaveBeenCalled()
    expect(mockGetArtifact).not.toHaveBeenCalled()
    expect(
      useArtifactStore
        .getState()
        .getArtifactRevisionMeta('art-1', { revisionId: 'rev-1' })?.artifact
        .title
    ).toBe('Cached Document')
  })
})

describe('createNewArtifact', () => {
  it('creates artifact with no revision, clears loaded/editable ids', async () => {
    mockCreateArtifact.mockResolvedValue('art-new')
    mockGetArtifact.mockResolvedValue(
      makeArtifact({ id: 'art-new', current_revision_id: null })
    )

    await useArtifactStore.getState().createNewArtifact('conv-1')

    expect(mockSetConversationActiveArtifact).toHaveBeenCalledWith(
      'conv-1',
      'art-new'
    )
    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().loadedRevisionId).toBeNull()
    expect(useArtifactStore.getState().editableRevisionId).toBeNull()
    expect(useArtifactStore.getState().headRevision).toBeNull()
  })
})

describe('ensureDocumentThreadMessage', () => {
  it('creates an editable empty draft and thread message for a brand-new artifact', async () => {
    const artifact = makeArtifact({ current_revision_id: null })
    useArtifactStore.setState({
      status: 'ready',
      artifact,
      headRevision: null,
      loadedRevisionId: null,
      editableRevisionId: null,
      loadedContent: '',
      editorKey: 'rev-empty',
      revisions: [],
    })
    mockCreateRevision.mockResolvedValue('rev-empty')
    mockAddSystemRevisionMessage.mockResolvedValue('sys-doc')

    await useArtifactStore
      .getState()
      .ensureDocumentThreadMessage(mockAddSystemRevisionMessage)

    expect(mockCreateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact_id: 'art-1',
        author: 'user',
        content: '',
        id: 'rev-empty',
      })
    )
    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith(
      'user',
      'art-1',
      'rev-empty'
    )
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().headRevision?.message_id).toBeNull()
    expect(useArtifactStore.getState().editableRevisionId).toBe('rev-empty')
  })

  it('anchors an existing editable draft without sealing it', async () => {
    const artifact = makeArtifact()
    const draft = makeRevision({ message_id: null })
    seedStore(artifact, [draft])

    await useArtifactStore
      .getState()
      .ensureDocumentThreadMessage(mockAddSystemRevisionMessage)

    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith(
      'user',
      'art-1',
      'rev-1'
    )
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().headRevision?.message_id).toBeNull()
  })
})

// ── Revision system message integration ───────────────────────────────────────

describe('system message integration — send flow', () => {
  it('9.9: user sends with changed content — system message created, revision sealed', async () => {
    const artifact = makeArtifact()
    const draft = makeRevision({ content: 'edited content', message_id: null })
    seedStore(artifact, [draft])
    mockAddSystemRevisionMessage.mockResolvedValue('sys-msg-new')

    const result = await useArtifactStore
      .getState()
      .sealForSend(mockAddSystemRevisionMessage)

    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith(
      'user',
      'art-1',
      'rev-1'
    )
    expect(mockSealRevision).toHaveBeenCalledWith('rev-1', 'sys-msg-new')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe(
      'sys-msg-new'
    )
    expect(result?.revisionId).toBe('rev-1')
  })

  it('9.10: user sends without changes — no system message, no new revision', async () => {
    const artifact = makeArtifact({ current_revision_id: 'rev-2' })
    const sealed = makeRevision({
      id: 'rev-1',
      message_id: 'sys-old',
      content: 'same',
    })
    const draft = makeRevision({
      id: 'rev-2',
      message_id: null,
      content: 'same',
    })
    seedStore(artifact, [sealed, draft])

    await useArtifactStore.getState().sealForSend(mockAddSystemRevisionMessage)

    expect(mockAddSystemRevisionMessage).not.toHaveBeenCalled()
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-1')
    expect(useArtifactStore.getState().editableRevisionId).toBeNull()
  })

  it('9.11: AI responds with artifact content — system message created with "ai", revision sealed', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    mockCreateRevision.mockResolvedValue('rev-ai-new')
    mockAddSystemRevisionMessage.mockResolvedValue('sys-ai')

    await useArtifactStore
      .getState()
      .applyAiRevision('AI wrote this', mockAddSystemRevisionMessage)

    expect(mockAddSystemRevisionMessage).toHaveBeenCalledWith(
      'ai',
      'art-1',
      'rev-ai-new'
    )
    expect(mockSealRevision).toHaveBeenCalledWith('rev-ai-new', 'sys-ai')
    expect(useArtifactStore.getState().headRevision?.author).toBe('ai')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe('sys-ai')
  })

  it('9.12: loading a new empty document defers thread anchoring to chat session', async () => {
    mockListArtifacts.mockResolvedValue([])
    mockCreateArtifact.mockResolvedValue('art-new')
    mockGetArtifact.mockResolvedValue(
      makeArtifact({ id: 'art-new', current_revision_id: null })
    )
    mockListRevisions.mockResolvedValue([])

    await useArtifactStore.getState().loadForConversation('conv-new')

    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(mockAddSystemRevisionMessage).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().headRevision).toBeNull()
  })
})
