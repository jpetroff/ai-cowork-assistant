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

const anchorMessageId = 'msg-anchor-1'

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

  it('does not create a revision for empty editor content', async () => {
    const artifact = makeArtifact({ current_revision_id: null })
    seedStore(artifact, [])
    useArtifactStore.setState({
      loadedRevisionId: null,
      editableRevisionId: null,
      headRevision: null,
      loadedContent: '',
    })

    await useArtifactStore.getState().save('')

    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(mockUpdateRevisionContent).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().headRevision).toBeNull()
  })

  it('does not update an existing draft when content is unchanged', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision({ message_id: null, content: 'same content' })
    seedStore(artifact, [rev])

    await useArtifactStore.getState().save('same content')

    expect(mockUpdateRevisionContent).not.toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
  })

  it('3: _persistToHead updates content when HEAD is a user draft', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision({ message_id: null }) // draft
    seedStore(artifact, [rev])
    await useArtifactStore.getState().save('updated')
    expect(mockUpdateRevisionContent).toHaveBeenCalledWith('rev-1', 'updated')
    expect(useArtifactStore.getState().loadedContent).toBe('updated')
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
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-first')
    expect(useArtifactStore.getState().editableRevisionId).toBe('rev-first')
    expect(useArtifactStore.getState().loadedContent).toBe('first content')
  })

  it('does not create duplicate revisions for repeated identical saves', async () => {
    const artifact = makeArtifact({ current_revision_id: null })
    seedStore(artifact, [])
    useArtifactStore.setState({
      loadedRevisionId: null,
      editableRevisionId: null,
      headRevision: null,
      loadedContent: '',
    })
    mockCreateRevision.mockResolvedValue('rev-first')

    await useArtifactStore.getState().save('first content')
    vi.clearAllMocks()
    await useArtifactStore.getState().save('first content')

    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(mockUpdateRevisionContent).not.toHaveBeenCalled()
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
    expect(useArtifactStore.getState().loadedContent).toBe('forked')
  })

  it('does not fork a sealed head when content is unchanged', async () => {
    const artifact = makeArtifact()
    const sealedRev = makeRevision({
      content: 'sealed content',
      message_id: 'msg-1',
    })
    seedStore(artifact, [sealedRev])

    await useArtifactStore.getState().save('sealed content')

    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(mockUpdateRevisionContent).not.toHaveBeenCalled()
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
    expect(useArtifactStore.getState().loadedContent).toBe('historical edit')
  })

  it('does not fork a loaded historical revision when content is unchanged', async () => {
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

    await useArtifactStore.getState().save('historical')

    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(mockUpdateRevisionContent).not.toHaveBeenCalled()
  })
})

// ── Seal chain ─────────────────────────────────────────────────────────────────

describe('sealForSend', () => {
  it('1: isDraft && changed → _sealDraftInPlace — seals revision with the user message', async () => {
    const artifact = makeArtifact()
    const draft = makeRevision({ content: 'new content', message_id: null })
    seedStore(artifact, [draft])
    const result = await useArtifactStore.getState().sealForSend('user-msg-1')
    expect(mockSealRevision).toHaveBeenCalledWith('rev-1', 'user-msg-1')
    expect(result?.revisionId).toBe('rev-1')
  })

  it('2: isDraft && !changed → _reuseLastSealed — no sealing work', async () => {
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
      .sealForSend(anchorMessageId)
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(result?.revisionId).toBe('rev-1')
  })

  it('3: !isDraft && changed → _createSealedRevision — seals new revision with the user message', async () => {
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
    const result = await useArtifactStore.getState().sealForSend('user-msg-2')
    expect(mockSealRevision).toHaveBeenCalledWith(
      'rev-new-sealed',
      'user-msg-2'
    )
    expect(result?.revisionId).toBe('rev-new-sealed')
  })

  it('4: !isDraft && !changed → _reuseCurrentHead — no sealing work', async () => {
    const sealed = makeRevision({ message_id: 'msg-1', content: 'same' })
    const artifact = makeArtifact({ current_revision_id: 'rev-1' })
    seedStore(artifact, [sealed])
    const result = await useArtifactStore
      .getState()
      .sealForSend(anchorMessageId)
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
      .sealForSend(anchorMessageId)

    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(result).toEqual({
      artifactId: 'art-1',
      revisionId: 'rev-1',
      content: 'historical content',
    })
  })

  it('returns empty content for an active artifact with no revisions', async () => {
    const artifact = makeArtifact({ current_revision_id: null })
    seedStore(artifact, [])
    useArtifactStore.setState({
      headRevision: null,
      loadedRevisionId: null,
      editableRevisionId: null,
      loadedContent: '',
    })

    const result = await useArtifactStore
      .getState()
      .sealForSend(anchorMessageId)

    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(result).toEqual({
      artifactId: 'art-1',
      revisionId: null,
      content: '',
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
  it('previews an ai draft in the active editor without creating a revision', () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])

    useArtifactStore.getState().previewAiRevisionDraft('streaming ai content')

    expect(useArtifactStore.getState().loadedContent).toBe(
      'streaming ai content'
    )
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-1')
    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(mockUpdateRevisionContent).not.toHaveBeenCalled()
    expect(mockSealRevision).not.toHaveBeenCalled()
  })

  it('does not preview ai draft content for an inactive artifact target', () => {
    const artifact = makeArtifact({ id: 'active-art' })
    const rev = makeRevision({ artifact_id: 'active-art' })
    seedStore(artifact, [rev])

    useArtifactStore
      .getState()
      .previewAiRevisionDraft('inactive streaming content', 'other-art')

    expect(useArtifactStore.getState().loadedContent).toBe('initial')
    expect(mockCreateRevision).not.toHaveBeenCalled()
  })

  it('inserts ai revision, seals it with the assistant message, sets loaded/editable ids', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    mockCreateRevision.mockResolvedValue('rev-ai')

    await useArtifactStore.getState().applyAiRevision('ai content', 'ai-msg-1')

    expect(mockCreateRevision).toHaveBeenCalledWith(
      expect.objectContaining({ author: 'ai' })
    )
    expect(mockSealRevision).toHaveBeenCalledWith('rev-ai', 'ai-msg-1')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe(
      'ai-msg-1'
    )
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

describe('getArtifactContextForSend', () => {
  it('returns empty content for a selected artifact with no revisions', async () => {
    const activeArtifact = makeArtifact({ id: 'active-art' })
    const selectedArtifact = makeArtifact({
      id: 'selected-art',
      current_revision_id: null,
    })
    seedStore(activeArtifact, [makeRevision({ artifact_id: 'active-art' })])
    mockGetArtifact.mockResolvedValue(selectedArtifact)
    mockListRevisions.mockResolvedValue([])

    const result = await useArtifactStore
      .getState()
      .getArtifactContextForSend('selected-art', anchorMessageId)

    expect(mockGetArtifact).toHaveBeenCalledWith('selected-art')
    expect(result).toEqual({
      artifactId: 'selected-art',
      revisionId: null,
      content: '',
    })
  })
})

// ── Revision message anchor integration ───────────────────────────────────────

describe('message anchor integration — send flow', () => {
  it('9.9: user sends with changed content — revision sealed with user message', async () => {
    const artifact = makeArtifact()
    const draft = makeRevision({ content: 'edited content', message_id: null })
    seedStore(artifact, [draft])

    const result = await useArtifactStore.getState().sealForSend('user-msg-new')

    expect(mockSealRevision).toHaveBeenCalledWith('rev-1', 'user-msg-new')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe(
      'user-msg-new'
    )
    expect(result?.revisionId).toBe('rev-1')
  })

  it('9.10: user sends without changes — no sealing work, no new revision', async () => {
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

    await useArtifactStore.getState().sealForSend(anchorMessageId)

    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().loadedRevisionId).toBe('rev-1')
    expect(useArtifactStore.getState().editableRevisionId).toBeNull()
  })

  it('9.11: AI responds with artifact content — revision sealed with assistant message', async () => {
    const artifact = makeArtifact()
    const rev = makeRevision()
    seedStore(artifact, [rev])
    mockCreateRevision.mockResolvedValue('rev-ai-new')

    await useArtifactStore
      .getState()
      .applyAiRevision('AI wrote this', 'assistant-msg-1')

    expect(mockSealRevision).toHaveBeenCalledWith(
      'rev-ai-new',
      'assistant-msg-1'
    )
    expect(useArtifactStore.getState().headRevision?.author).toBe('ai')
    expect(useArtifactStore.getState().headRevision?.message_id).toBe(
      'assistant-msg-1'
    )
  })

  it('9.12: loading a new empty document leaves it revisionless until save', async () => {
    mockListArtifacts.mockResolvedValue([])
    mockCreateArtifact.mockResolvedValue('art-new')
    mockGetArtifact.mockResolvedValue(
      makeArtifact({ id: 'art-new', current_revision_id: null })
    )
    mockListRevisions.mockResolvedValue([])

    await useArtifactStore.getState().loadForConversation('conv-new')

    expect(mockSealRevision).not.toHaveBeenCalled()
    expect(mockCreateRevision).not.toHaveBeenCalled()
    expect(useArtifactStore.getState().headRevision).toBeNull()
  })
})
