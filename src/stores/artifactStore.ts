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
  listRevisions,
  updateRevisionContent,
  sealRevision,
} from '@/lib/db/repositories/revisions'
import { setConversationActiveArtifact } from '@/lib/db/repositories/conversations'
import type { Artifact, ArtifactRevision } from '@/lib/db/types'
import type { SaveRequest, ContentSwapRequest, SealResult } from '@/lib/types'
import { canEditInPlace, findLastSealedRevision, hasContentChangedSinceLastSeal } from '@/lib/revision-utils'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Callback injected into the seal chain to create a system message anchoring the revision in the thread. */
type SysMsgCreator = (revisionId: string, author: 'user' | 'ai') => Promise<string>

interface ArtifactState {
  artifact: Artifact | null
  headRevision: ArtifactRevision | null
  /** The revision ID currently loaded in the TipTap editor. Updated by EditorPanel via _flushRef pattern. */
  loadedRevisionId: string | null
  revisions: ArtifactRevision[]
  contentSwapRequest: ContentSwapRequest | null
  isSaving: boolean
  saveError: string | null
  externalChangeDetected: boolean
}

interface ArtifactActions {
  /**
   * Reset all state to initial values. Called when switching conversations.
   */
  reset: () => void
  /**
   * Load artifact + all revisions for a conversation. Creates an initial empty
   * user-draft artifact+revision if none exist. Sets contentSwapRequest for the
   * EditorPanel to process.
   */
  loadForConversation: (conversationId: string) => Promise<void>
  /**
   * Persist content from the editor. Entry point for the save chain.
   * Stale revisionId → silently discarded. isSaving guard → silently discarded.
   */
  save: (request: SaveRequest) => Promise<void>
  /**
   * Seal the active revision before sending. Returns the revision to attach to
   * the outgoing message, or null if there is no artifact.
   * `sysMsgCreator` is called only when a revision is actually sealed/created —
   * reuse paths never invoke it.
   */
  sealForSend: (sysMsgCreator?: SysMsgCreator) => Promise<SealResult | null>
  /**
   * Apply an AI-generated revision. Inserts new author='ai' revision as HEAD
   * and triggers a contentSwapRequest so the editor displays the new content.
   */
  applyAiRevision: (content: string, sysMsgCreator: SysMsgCreator) => Promise<void>
  /**
   * Load a historical revision into the editor without changing current_revision_id.
   */
  requestRevisionLoad: (revisionId: string) => void
  /**
   * Create a brand-new artifact for the conversation with an empty user-draft revision.
   */
  createNewArtifact: (conversationId: string) => Promise<void>
  /**
   * Rename the active artifact title.
   */
  rename: (title: string | null) => Promise<void>
  /**
   * Acknowledge the content swap — clears contentSwapRequest. Called by EditorPanel
   * after applying the swap in useLayoutEffect.
   */
  acknowledgeSwap: () => void
  /** Check whether the linked disk file has changed since last sync. */
  checkExternalChange: () => Promise<void>
  /** Reload content from the linked disk file as a new user-draft revision. */
  reloadFromDisk: () => Promise<void>
  /** Link the artifact to a relative file path on disk. */
  linkToDisk: (relativePath: string) => Promise<void>
  // Internal helpers — not for direct use outside the store
  _requestContentSwap: (revisionId: string, content: string) => void
  _createUserDraft: (content: string) => Promise<ArtifactRevision>
  _persistToHead: (content: string) => Promise<void>
  _createDraftThenPersist: (content: string) => Promise<void>
  _createDraftFromOldRevision: (content: string) => Promise<void>
  _syncToDiskIfLinked: (content: string) => Promise<void>
  _sealDraftInPlace: (sysMsgCreator: SysMsgCreator) => Promise<SealResult>
  _reuseLastSealed: () => SealResult | null
  _createSealedRevision: (sysMsgCreator: SysMsgCreator) => Promise<SealResult>
  _reuseCurrentHead: () => SealResult | null
}

// ── Non-reactive bridge for EditorPanel flush ─────────────────────────────────
// Plain mutable object — NOT Zustand state. No re-renders triggered.
// EditorPanel writes its flushPendingSave function here on mount.
// ChatInput reads from here before sealing.
export const artifactFlushRef: { current: (() => Promise<void>) | null } = { current: null }

const INITIAL_STATE: ArtifactState = {
  artifact: null,
  headRevision: null,
  loadedRevisionId: null,
  revisions: [],
  contentSwapRequest: null,
  isSaving: false,
  saveError: null,
  externalChangeDetected: false,
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useArtifactStore = create<ArtifactState & ArtifactActions>((set, get) => ({
  ...INITIAL_STATE,

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  reset() {
    set(INITIAL_STATE)
  },

  async loadForConversation(conversationId) {
    set({ ...INITIAL_STATE })

    let artifacts = await listArtifacts(conversationId)
    let artifact: Artifact

    if (artifacts.length === 0) {
      // No artifacts yet — create initial empty artifact + user-draft revision
      const artifactId = await createArtifact({ conversation_id: conversationId })
      const revisionId = await createRevision({ artifact_id: artifactId, author: 'user', content: '' })
      await updateArtifact(artifactId, { current_revision_id: revisionId })
      await setConversationActiveArtifact(conversationId, artifactId)

      artifact = (await getArtifact(artifactId))!
    } else {
      // Activate artifact referenced by active_artifact_id, fall back to most-recently-updated
      // Note: conversations.active_artifact_id is loaded with the conversation — use artifacts list as source of truth
      artifact = artifacts.reduce((prev, cur) => (cur.updated_at > prev.updated_at ? cur : prev))
    }

    const revisions = await listRevisions(artifact.id)
    // listRevisions returns DESC, reverse to get ASC for store
    const revisionsAsc = [...revisions].reverse()

    const headRevision = artifact.current_revision_id
      ? (revisionsAsc.find((r) => r.id === artifact.current_revision_id) ?? revisionsAsc[revisionsAsc.length - 1] ?? null)
      : (revisionsAsc[revisionsAsc.length - 1] ?? null)

    set({ artifact, headRevision, revisions: revisionsAsc })

    if (headRevision) {
      get()._requestContentSwap(headRevision.id, headRevision.content)
    }

    // Check external file change if artifact is linked to disk
    if (artifact.file_path) {
      get().checkExternalChange()
    }
  },

  // ── Internal helpers ────────────────────────────────────────────────────────

  _requestContentSwap(revisionId: string, content: string) {
    set({ loadedRevisionId: revisionId, contentSwapRequest: { revisionId, content } })
  },

  acknowledgeSwap() {
    set({ contentSwapRequest: null })
  },

  async _createUserDraft(content: string): Promise<ArtifactRevision> {
    const { artifact, revisions } = get()
    if (!artifact) throw new Error('No active artifact')

    const revisionId = await createRevision({ artifact_id: artifact.id, author: 'user', content })
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
      revisions: [...revisions, newRevision],
    })

    return newRevision
  },

  // ── Save chain ──────────────────────────────────────────────────────────────

  /**
   * Save entry point. Routes through the chain-of-responsibility:
   * 1. Stale revision check (loadedRevisionId !== revisionId → discard)
   * 2. isSaving concurrency guard → discard
   * 3. headRevision.message_id === null && content unchanged → _persistToHead
   * 4. headRevision.message_id === null → _persistToHead (same path, content changed)
   * 5. headRevision is current HEAD and editing → _createDraftThenPersist
   * 6. Editing a non-HEAD revision → _createDraftFromOldRevision
   */
  async save(request) {
    const { loadedRevisionId, headRevision, isSaving } = get()

    // Guard: stale revision ID — the editor is editing an outdated revision
    if (loadedRevisionId !== request.revisionId) return

    // Guard: concurrent save already in flight
    if (isSaving) return

    if (!headRevision) return

    set({ isSaving: true, saveError: null })
    try {
      const isHeadRevision = request.revisionId === headRevision.id

      if (isHeadRevision && canEditInPlace(headRevision)) {
        // HEAD is a user draft — persist in place
        await get()._persistToHead(request.content)
      } else if (isHeadRevision) {
        // HEAD is sealed — copy-on-write: create new draft
        await get()._createDraftThenPersist(request.content)
      } else {
        // Editing a non-HEAD revision — fork a new draft from it
        await get()._createDraftFromOldRevision(request.content)
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
    const newDraft = await get()._createUserDraft(content)
    // Update loadedRevisionId — second useLayoutEffect in EditorPanel will sync revisionIdRef
    set({ loadedRevisionId: newDraft.id })
    await get()._syncToDiskIfLinked(content)
  },

  async _createDraftFromOldRevision(content: string) {
    const newDraft = await get()._createUserDraft(content)
    set({ loadedRevisionId: newDraft.id })
    await get()._syncToDiskIfLinked(content)
  },

  async _syncToDiskIfLinked(content: string) {
    const { artifact } = get()
    if (!artifact?.file_path) return

    try {
      await invoke('write_file', { path: artifact.file_path, content })
      // Compute hash via Tauri command
      const hash = await invoke<string>('hash_file_content', { content })
      await updateArtifact(artifact.id, { file_hash: hash })
      set((s) => ({ artifact: s.artifact ? { ...s.artifact, file_hash: hash } : null }))
    } catch (err) {
      // DB save already succeeded — only disk sync failed [ERR-EDT-002]
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
  async sealForSend(sysMsgCreator) {
    const { headRevision, revisions, artifact } = get()
    if (!headRevision || !artifact) return null

    const isDraft = canEditInPlace(headRevision)
    const changed = hasContentChangedSinceLastSeal(headRevision, revisions)

    if (isDraft && changed) {
      return get()._sealDraftInPlace(sysMsgCreator!)
    } else if (isDraft && !changed) {
      return get()._reuseLastSealed()
    } else if (!isDraft && changed) {
      return get()._createSealedRevision(sysMsgCreator!)
    } else {
      return get()._reuseCurrentHead()
    }
  },

  async _sealDraftInPlace(sysMsgCreator: SysMsgCreator): Promise<SealResult> {
    const { headRevision, artifact } = get()
    if (!headRevision || !artifact) throw new Error('No active revision')

    const sysMsgId = await sysMsgCreator(headRevision.id, 'user')
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

  async _createSealedRevision(sysMsgCreator: SysMsgCreator): Promise<SealResult> {
    const { headRevision, artifact, revisions } = get()
    if (!headRevision || !artifact) throw new Error('No active revision')

    const revisionId = await createRevision({
      artifact_id: artifact.id,
      author: 'user',
      content: headRevision.content,
    })
    const sysMsgId = await sysMsgCreator(revisionId, 'user')
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
      loadedRevisionId: revisionId,
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

  async applyAiRevision(content, sysMsgCreator) {
    const { artifact, revisions } = get()
    if (!artifact) return

    const revisionId = await createRevision({
      artifact_id: artifact.id,
      author: 'ai',
      content,
    })
    const sysMsgId = await sysMsgCreator(revisionId, 'ai')
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
      revisions: [...revisions, newRevision],
    })

    get()._requestContentSwap(revisionId, content)
  },

  requestRevisionLoad(revisionId) {
    const { revisions } = get()
    const revision = revisions.find((r) => r.id === revisionId)
    if (!revision) return
    get()._requestContentSwap(revisionId, revision.content)
  },

  async createNewArtifact(conversationId) {
    const artifactId = await createArtifact({ conversation_id: conversationId })
    const revisionId = await createRevision({ artifact_id: artifactId, author: 'user', content: '' })
    await updateArtifact(artifactId, { current_revision_id: revisionId })
    await setConversationActiveArtifact(conversationId, artifactId)

    const artifact = (await getArtifact(artifactId))!
    const newRevision: ArtifactRevision = {
      id: revisionId,
      artifact_id: artifactId,
      message_id: null,
      author: 'user',
      content: '',
      created_at: Date.now(),
      updated_at: Date.now(),
    }

    set({
      artifact,
      headRevision: newRevision,
      revisions: [newRevision],
    })

    get()._requestContentSwap(revisionId, '')
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

    const content = await invoke<string>('read_file', { path: artifact.file_path })
    await get()._createUserDraft(content)
    set({ externalChangeDetected: false })
    get()._requestContentSwap(get().headRevision!.id, content)
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
