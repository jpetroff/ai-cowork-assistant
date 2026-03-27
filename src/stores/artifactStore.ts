import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'
import {
  listArtifacts,
  createArtifact,
  updateArtifact,
  getArtifact,
} from '@/lib/db/repositories/documents'
import {
  createRevision,
  getRevision,
  listRevisions,
  updateRevisionContent,
  sealRevision,
} from '@/lib/db/repositories/revisions'
import { setConversationActiveArtifact } from '@/lib/db/repositories/conversations'
import type { Artifact, ArtifactRevision } from '@/lib/db/types'
import type { SealResult } from '@/lib/types'
import { canEditInPlace, findLastSealedRevision, hasContentChangedSinceLastSeal, parseRevisionMetadata } from '@/lib/revision-utils'
import { useMessageStore } from '@/stores/messageStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

/** @property revisionId - specific revision to look up; defaults to head revision */
/** @property includeContent - whether to include revision content (default: false) */
interface ArtifactRevisionMetaOptions {
  revisionId?: string
  includeContent?: boolean
}

/** @property artifact - the artifact metadata */
/** @property revision - revision metadata, content omitted unless includeContent is true */
interface ArtifactRevisionMeta {
  artifact: Artifact
  revision: Omit<ArtifactRevision, 'content'> | ArtifactRevision
}

interface ArtifactState {
  status: StoreStatus
  artifact: Artifact | null
  headRevision: ArtifactRevision | null
  /**
   * The revision ID the editor is currently persisting to.
   * null = no revision exists yet (new document) or viewing a historical revision
   * (next save will create a new user-draft revision).
   */
  activeRevisionId: string | null
  /** The content to initialize the editor with on mount. Owned by the store; editor owns its own live state. */
  loadedContent: string
  /** Changes when the editor should remount with fresh content (e.g. AI revision, history load). */
  editorKey: string | null
  revisions: ArtifactRevision[]
  isSaving: boolean
  saveError: string | null
  externalChangeDetected: boolean
}

interface ArtifactActions {
  /** Reset all state to initial values. Called when switching conversations. */
  reset: () => void
  /**
   * Load artifact for a conversation. If no artifact exists, creates one (no revision —
   * first editor save will create the initial revision).
   * Sets status to 'loading' while fetching, then 'ready'.
   */
  loadForConversation: (conversationId: string) => Promise<void>
  /**
   * Persist content from the editor. Routes through the save chain based on activeRevisionId:
   * - status !== 'ready' → silently discarded (guards transition saves from unmount cleanup)
   * - isSaving → silently discarded
   * - activeRevisionId === null && revisions empty → creates first draft + anchor system message
   * - activeRevisionId === null → creates new user-draft revision (fork from historical view)
   * - activeRevisionId === headRevision.id && isDraft → _persistToHead
   * - activeRevisionId === headRevision.id && sealed → _createDraftThenPersist
   */
  save: (content: string) => Promise<void>
  /**
   * Seal the active revision before sending. Returns the revision to attach to
   * the outgoing message, or null if there is no artifact / no revisions.
   * A system message is created automatically when a revision is actually sealed/created.
   */
  sealForSend: () => Promise<SealResult | null>
  /**
   * Apply an AI-generated revision. Inserts a new author='ai' sealed revision as HEAD
   * and remounts the editor with the new content.
   */
  applyAiRevision: (content: string) => Promise<void>
  /**
   * Load a revision into the editor.
   * - Flushes any pending save and waits for it to complete.
   * - Sets status to 'loading' (drops saves from unmount cleanup).
   * - If the revision is HEAD: sets activeRevisionId = revisionId.
   * - If historical: sets activeRevisionId = null (next edit forks a new draft).
   */
  requestRevisionLoad: (revisionId: string) => Promise<void>
  /**
   * Create a brand-new artifact for the conversation with no initial revision.
   */
  createNewArtifact: (conversationId: string) => Promise<void>
  /** Rename the active artifact title. */
  rename: (title: string | null) => Promise<void>
  /** Check whether the linked disk file has changed since last sync. */
  checkExternalChange: () => Promise<void>
  /** Reload content from the linked disk file as a new user-draft revision. */
  reloadFromDisk: () => Promise<void>
  /** Link the artifact to a relative file path on disk. */
  linkToDisk: (relativePath: string) => Promise<void>
  /**
   * Look up artifact and revision metadata by artifact ID.
   * Returns null if the artifact ID doesn't match the loaded artifact, or if no artifact is loaded.
   * @param artifactId - must match the currently loaded artifact
   * @param options.revisionId - specific revision to return; defaults to head revision
   * @param options.includeContent - include revision content in result (default: false)
   */
  getArtifactRevisionMeta: (artifactId: string, options?: ArtifactRevisionMetaOptions) => ArtifactRevisionMeta | null
  // Internal helpers — not for direct use outside the store
  _createUserDraft: (content: string) => Promise<ArtifactRevision>
  _persistToHead: (content: string) => Promise<void>
  _createDraftThenPersist: (content: string) => Promise<void>
  _syncToDiskIfLinked: (content: string) => Promise<void>
  _sealDraftInPlace: () => Promise<SealResult>
  _reuseLastSealed: () => SealResult | null
  _createSealedRevision: () => Promise<SealResult>
  _reuseCurrentHead: () => SealResult | null
  /**
   * Set editor-relevant state and transition to 'ready'.
   * Shared between loadForConversation and requestRevisionLoad.
   * - isHead=true  → activeRevisionId = revision.id (editor persists to this revision)
   * - isHead=false → activeRevisionId = null (next save forks a new draft)
   */
  _mountRevision: (revision: ArtifactRevision | null, isHead: boolean) => void
}

const INITIAL_STATE: ArtifactState = {
  status: 'loading',
  artifact: null,
  headRevision: null,
  activeRevisionId: null,
  loadedContent: '',
  editorKey: null,
  revisions: [],
  isSaving: false,
  saveError: null,
  externalChangeDetected: false
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useArtifactStore = create<ArtifactState & ArtifactActions>((set, get) => ({
  ...INITIAL_STATE,

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  reset() {
    set(INITIAL_STATE)
  },

  async loadForConversation(conversationId) {
    set({ ...INITIAL_STATE, status: 'loading' })

    try {
      let artifacts = await listArtifacts(conversationId)
      let artifact: Artifact

      if (artifacts.length === 0) {
        // No artifact yet — create one, but do NOT create a revision.
        // The editor will start empty; the first save creates the initial revision.
        const artifactId = await createArtifact({ conversation_id: conversationId })
        await setConversationActiveArtifact(conversationId, artifactId)
        artifact = (await getArtifact(artifactId))!
      } else {
        artifact = artifacts.reduce((prev, cur) => (cur.updated_at > prev.updated_at ? cur : prev))
      }

      const revisions = await listRevisions(artifact.id)
      // listRevisions returns DESC, reverse to get ASC for store
      const revisionsAsc = [...revisions].reverse()

      const headRevision = artifact.current_revision_id
        ? (revisionsAsc.find((r) => r.id === artifact.current_revision_id) ?? revisionsAsc[revisionsAsc.length - 1] ?? null)
        : (revisionsAsc[revisionsAsc.length - 1] ?? null)

      set({ artifact, headRevision, revisions: revisionsAsc })
      get()._mountRevision(headRevision, true)

      if (artifact.file_path) {
        get().checkExternalChange()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load artifact'
      console.error('[artifactStore] loadForConversation error:', message)
      set({ status: 'error' })
    }
  },

  // ── Internal helpers ────────────────────────────────────────────────────────

  _mountRevision(revision, isHead) {

    // editorKey serves as new revision ID for an unsaved draft
    // when saving with revisionId == null → new revision gets editorKey as ID 
    // no re-render on draft persist
    let newRevisionId = crypto.randomUUID()

    set({
      activeRevisionId: isHead ? (revision?.id ?? null) : null,
      loadedContent: revision?.content ?? '',
      editorKey: revision
        ? (isHead ? revision.id : newRevisionId)
        : newRevisionId,
      status: 'ready',
    })
  },

  async _createUserDraft(content: string): Promise<ArtifactRevision> {
    const { artifact, revisions, editorKey } = get()
    if (!artifact) throw new Error('No active artifact')

    // Only use editorKey as the pre-allocated ID when it is a truly fresh UUID
    // (not the ID of an existing revision). If editorKey matches an existing revision
    // (e.g. head was sealed since mount, editorKey still points to it), a fresh UUID
    // is generated instead to avoid a UNIQUE constraint violation on INSERT.
    const keyIsFresh = editorKey && !revisions.some((r) => r.id === editorKey)
    const revisionId = await createRevision({ artifact_id: artifact.id, author: 'user', content, id: keyIsFresh ? editorKey : undefined })
    await updateArtifact(artifact.id, { current_revision_id: revisionId })

    const newRevision: ArtifactRevision = {
      id: revisionId,
      artifact_id: artifact.id,
      message_id: null,
      author: 'user',
      content,
      created_at: Date.now(),
      updated_at: Date.now(),
    }

    const updatedArtifact = { ...artifact, current_revision_id: revisionId, updated_at: Date.now() }
    set({
      artifact: updatedArtifact,
      headRevision: newRevision,
      activeRevisionId: revisionId,
      revisions: [...revisions, newRevision],
    })

    return newRevision
  },

  // ── Save chain ──────────────────────────────────────────────────────────────

  async save(content) {
    const { status, activeRevisionId, headRevision, isSaving, artifact, revisions } = get()

    console.debug('[artifactStore] save trigger:', status, isSaving, artifact)
    // Guard: drop saves during loading transitions (e.g. from editor unmount cleanup)
    if (status !== 'ready') return

    // Guard: concurrent save already in flight
    if (isSaving) return

    // Guard: no artifact to save to
    if (!artifact) return

    set({ isSaving: true, saveError: null })
    try {

      // begin actual save
      console.debug(`[artifactStore] activeRevisionId=${activeRevisionId} revisions.length=${revisions.length} headRevision=${headRevision}`)

      if (activeRevisionId === null) {
        const isFirstRevision = revisions.length === 0
        const draft = await get()._createUserDraft(content)
        // Create a chat anchor for the very first revision so users can always navigate back to it
        if (isFirstRevision) {
          await useMessageStore.getState().addSystemRevisionMessage('user', artifact.id, draft.id, )
        }
      } else if (activeRevisionId === headRevision?.id && canEditInPlace(headRevision)) {
        // HEAD is a user draft — persist in place
        await get()._persistToHead(content)
      } else if (activeRevisionId === headRevision?.id) {
        // HEAD is sealed — copy-on-write: create new draft
        await get()._createDraftThenPersist(content)
      } else {
        // activeRevisionId doesn't match head — shouldn't happen in normal flow,
        // treat as a new draft to avoid data loss
        await get()._createDraftThenPersist(content)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Save failed'
      console.error('[artifactStore] save error:', message)
      set({ saveError: message })
    } finally {
      set({ isSaving: false })
    }
  },

  async _persistToHead(content: string) {
    const { headRevision } = get()
    console.debug(`[artifactStore._persistToHead] headRevision=${headRevision} ← should be always not NULL!`)
    if (!headRevision) return

    await updateRevisionContent(headRevision.id, content)
    set((s) => ({
      headRevision: s.headRevision ? { ...s.headRevision, content, updated_at: Date.now() } : null,
      revisions: s.revisions.map((r) =>
        r.id === headRevision.id ? { ...r, content, updated_at: Date.now() } : r
      ),
    }))

    await get()._syncToDiskIfLinked(content)
  },

  async _createDraftThenPersist(content: string) {
    // _createUserDraft sets activeRevisionId to the new draft's id
    await get()._createUserDraft(content)
    await get()._syncToDiskIfLinked(content)
  },

  async _syncToDiskIfLinked(content: string) {
    const { artifact } = get()
    if (!artifact?.file_path) return

    try {
      await invoke('write_file', { path: artifact.file_path, content })
      const hash = await invoke<string>('hash_file_content', { content })
      await updateArtifact(artifact.id, { file_hash: hash })
      set((s) => ({ artifact: s.artifact ? { ...s.artifact, file_hash: hash } : null }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Disk sync failed'
      console.error('[artifactStore] disk sync error:', message)
      set({ saveError: `Disk sync failed: ${message}` })
    }
  },

  // ── Seal chain ──────────────────────────────────────────────────────────────

  /**
   * Seal entry point. Routes through four links based on isDraft × changed matrix:
   * - isDraft  && changed  → _sealDraftInPlace
   * - isDraft  && !changed → _reuseLastSealed (or HEAD as fallback)
   * - !isDraft && changed  → _createSealedRevision
   * - !isDraft && !changed → _reuseCurrentHead
   */
  async sealForSend() {
    const { headRevision, revisions, artifact } = get()
    if (!headRevision || !artifact) return null

    const isDraft = canEditInPlace(headRevision)
    const changed = hasContentChangedSinceLastSeal(headRevision, revisions)

    if (isDraft && changed) {
      return get()._sealDraftInPlace()
    } else if (isDraft && !changed) {
      return get()._reuseLastSealed()
    } else if (!isDraft && changed) {
      return get()._createSealedRevision()
    } else {
      return get()._reuseCurrentHead()
    }
  },

  async _sealDraftInPlace(): Promise<SealResult> {
    const { headRevision, artifact } = get()
    if (!headRevision || !artifact) throw new Error('No active revision')

    // If an anchor message already exists for this revision (created at first-draft time),
    // reuse it as the seal message to avoid a duplicate card in the chat thread.
    const existingAnchor = useMessageStore.getState().messages.find(
      (m) => parseRevisionMetadata(m)?.revisionId === headRevision.id
    )
    const sysMsgId = existingAnchor
      ? existingAnchor.id
      : await useMessageStore.getState().addSystemRevisionMessage('user', artifact.id, headRevision.id, )

    await sealRevision(headRevision.id, sysMsgId)
    const sealed = { ...headRevision, message_id: sysMsgId }
    set((s) => ({
      headRevision: sealed,
      revisions: s.revisions.map((r) => (r.id === headRevision.id ? sealed : r)),
    }))

    return { artifactId: artifact.id, revisionId: headRevision.id, content: headRevision.content }
  },

  _reuseLastSealed(): SealResult | null {
    const { revisions, headRevision, artifact } = get()
    if (!artifact) return null
    const lastSealed = findLastSealedRevision(revisions)
    const target = lastSealed ?? headRevision
    if (!target) return null
    return { artifactId: artifact.id, revisionId: target.id, content: target.content }
  },

  async _createSealedRevision(): Promise<SealResult> {
    const { headRevision, artifact, revisions } = get()
    if (!headRevision || !artifact) throw new Error('No active revision')

    const revisionId = await createRevision({
      artifact_id: artifact.id,
      author: 'user',
      content: headRevision.content,
    })
    const sysMsgId = await useMessageStore.getState().addSystemRevisionMessage('user', artifact.id, revisionId, )
    await sealRevision(revisionId, sysMsgId)
    await updateArtifact(artifact.id, { current_revision_id: revisionId })

    const newRevision: ArtifactRevision = {
      id: revisionId,
      artifact_id: artifact.id,
      message_id: sysMsgId,
      author: 'user',
      content: headRevision.content,
      created_at: Date.now(),
      updated_at: Date.now(),
    }

    const updatedArtifact = { ...artifact, current_revision_id: revisionId, updated_at: Date.now() }
    set({
      artifact: updatedArtifact,
      headRevision: newRevision,
      activeRevisionId: revisionId,
      revisions: [...revisions, newRevision],
    })

    return { artifactId: artifact.id, revisionId, content: headRevision.content }
  },

  _reuseCurrentHead(): SealResult | null {
    const { headRevision, artifact } = get()
    if (!headRevision || !artifact) return null
    return { artifactId: artifact.id, revisionId: headRevision.id, content: headRevision.content }
  },

  // ── External triggers ────────────────────────────────────────────────────────

  async applyAiRevision(content: string) {
    const { artifact, revisions } = get()
    if (!artifact) return

    const revisionId = await createRevision({
      artifact_id: artifact.id,
      author: 'ai',
      content,
    })
    const sysMsgId = await useMessageStore.getState().addSystemRevisionMessage('ai', artifact.id, revisionId, )
    await sealRevision(revisionId, sysMsgId)
    await updateArtifact(artifact.id, { current_revision_id: revisionId })

    const newRevision: ArtifactRevision = {
      id: revisionId,
      artifact_id: artifact.id,
      message_id: sysMsgId,
      author: 'ai',
      content,
      created_at: Date.now(),
      updated_at: Date.now(),
    }

    const updatedArtifact = { ...artifact, current_revision_id: revisionId, updated_at: Date.now() }
    set({
      artifact: updatedArtifact,
      headRevision: newRevision,
      activeRevisionId: revisionId,
      loadedContent: content,
      editorKey: revisionId,
      revisions: [...revisions, newRevision],
    })
  },

  async requestRevisionLoad(revisionId) {
    // Set loading — any saves fired by editor unmount cleanup will be dropped
    set({ status: 'loading' })

    // Yield to let React commit the loading state (editor unmounts, cleanup saves are dropped)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    const { revisions: currentRevisions, artifact: currentArtifact } = get()

    const revision = currentRevisions.find((r) => r.id === revisionId) ?? await getRevision(revisionId)
    if (!revision) { set({ status: 'ready' }); return }

    // If the revision belongs to a different artifact, load that artifact's full context first
    if (revision.artifact_id !== currentArtifact?.id) {
      const targetArtifact = await getArtifact(revision.artifact_id)
      if (!targetArtifact) { set({ status: 'ready' }); return }

      const allRevisions = await listRevisions(targetArtifact.id)
      const revisionsAsc = [...allRevisions].reverse()
      const targetHead = targetArtifact.current_revision_id
        ? (revisionsAsc.find((r) => r.id === targetArtifact.current_revision_id) ?? revisionsAsc[revisionsAsc.length - 1] ?? null)
        : (revisionsAsc[revisionsAsc.length - 1] ?? null)

      set({ artifact: targetArtifact, headRevision: targetHead, revisions: revisionsAsc })
    }

    const { headRevision } = get()
    const isHead = revisionId === headRevision?.id
    get()._mountRevision(revision, isHead)
  },

  async createNewArtifact(conversationId) {
    const artifactId = await createArtifact({ conversation_id: conversationId })
    await setConversationActiveArtifact(conversationId, artifactId)
    const artifact = (await getArtifact(artifactId))!

    set({
      artifact,
      headRevision: null,
      activeRevisionId: null,
      loadedContent: '',
      editorKey: crypto.randomUUID(),
      revisions: [],
      status: 'ready',
    })
  },

  async rename(title) {
    const { artifact } = get()
    if (!artifact) return
    const effectiveTitle = title && title.trim() !== '' ? title.trim() : null
    await updateArtifact(artifact.id, { title: effectiveTitle })
    set((s) => ({ artifact: s.artifact ? { ...s.artifact, title: effectiveTitle } : null }))
  },

  // ── File sync ────────────────────────────────────────────────────────────────

  async checkExternalChange() {
    const { artifact } = get()
    if (!artifact?.file_path || !artifact.file_hash) return

    try {
      const diskHash = await invoke<string>('hash_file', { path: artifact.file_path })
      if (diskHash !== artifact.file_hash) {
        set({ externalChangeDetected: true })
      }
    } catch {
      // File may not exist yet — ignore
    }
  },

  async reloadFromDisk() {
    const { artifact } = get()
    if (!artifact?.file_path) return

    set({ status: 'loading' })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    const content = await invoke<string>('read_file', { path: artifact.file_path })
    const newDraft = await get()._createUserDraft(content)
    set({
      externalChangeDetected: false,
      loadedContent: content,
      editorKey: newDraft.id,
      status: 'ready',
    })
  },

  getArtifactRevisionMeta(artifactId, options = {}) {
    const { artifact, headRevision, revisions } = get()
    if (!artifact || artifact.id !== artifactId) return null

    const { revisionId, includeContent = false } = options
    let revision: ArtifactRevision | undefined

    if (revisionId) {
      revision = revisions.find((r) => r.id === revisionId)
    } else {
      revision = headRevision ?? undefined
    }

    if (!revision) return null

    const revisionOut = includeContent ? revision : (({ content: _c, ...rest }) => rest)(revision)
    return { artifact, revision: revisionOut }
  },

  async linkToDisk(relativePath) {
    const { artifact, headRevision } = get()
    if (!artifact || !headRevision) return

    const content = headRevision.content
    await invoke('write_file', { path: relativePath, content })
    const hash = await invoke<string>('hash_file_content', { content })
    await updateArtifact(artifact.id, { file_path: relativePath, file_hash: hash })
    set((s) => ({
      artifact: s.artifact ? { ...s.artifact, file_path: relativePath, file_hash: hash } : null,
    }))
  },
}))

// Convenience accessor without subscribing to state — for use in non-React code (e.g. sidecar store)
export const getArtifactStore = () => useArtifactStore.getState()
