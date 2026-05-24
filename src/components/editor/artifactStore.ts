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
import {
  getConversation,
  setConversationActiveArtifact,
} from '@/lib/db/repositories/conversations'
import type { Artifact, ArtifactRevision } from '@/lib/db/types'
import type { SealResult } from '@/lib/types'
import { console_if } from '@/lib/logger'
import {
  canEditInPlace,
  findLastSealedRevision,
  hasContentChangedSinceLastSeal,
} from '@/lib/revision-utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'
type ArtifactRevisionSummary = Omit<ArtifactRevision, 'content'>

/** @property artifactId - artifact referenced by a thread revision message */
/** @property revisionId - revision referenced by a thread revision message */
interface ArtifactRevisionMetaReference {
  artifactId: string
  revisionId: string
}

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
  revision: ArtifactRevisionSummary | ArtifactRevision
}

interface ArtifactState {
  status: StoreStatus
  artifact: Artifact | null
  headRevision: ArtifactRevision | null
  /** @property loadedRevisionId - revision currently shown in the editor and highlighted in chat/history */
  loadedRevisionId: string | null
  /** @property editableRevisionId - revision safe to persist in place; null means next save creates a user draft */
  editableRevisionId: string | null
  /** The content to initialize the editor with on mount. Owned by the store; editor owns its own live state. */
  loadedContent: string
  /** Changes when the editor should remount with fresh content (e.g. AI revision, history load). */
  editorKey: string | null
  revisions: ArtifactRevision[]
  artifactRevisionMetaByRevisionId: Record<string, ArtifactRevisionMeta>
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
   * Persist content from the editor. Routes through the save chain based on editableRevisionId:
   * - status !== 'ready' → silently discarded (guards transition saves from unmount cleanup)
   * - isSaving → silently discarded
   * - editableRevisionId === null → creates a new user-draft revision (first save or historical fork)
   * - editableRevisionId === headRevision.id && isDraft → _persistToHead
   * - editableRevisionId === headRevision.id && sealed → _createDraftThenPersist
   */
  save: (content: string) => Promise<void>
  /**
   * Seal the active revision before sending. Returns the revision to attach to
   * the outgoing message, or null if there is no artifact / no revisions.
   * The supplied user message ID is stored as the revision anchor when a revision
   * is actually sealed/created.
   */
  sealForSend: (messageId: string) => Promise<SealResult | null>
  /** @property getArtifactContextForSend - returns message context for a specific artifact without loading it into the editor */
  getArtifactContextForSend: (
    artifactId: string,
    messageId: string
  ) => Promise<SealResult | null>
  /**
   * Apply an AI-generated revision. Inserts a new author='ai' sealed revision as HEAD
   * and remounts the editor with the new content.
   */
  applyAiRevision: (
    content: string,
    messageId: string,
    artifactId?: string
  ) => Promise<void>
  /**
   * Load a revision into the editor.
   * - Flushes any pending save and waits for it to complete.
   * - Sets status to 'loading' (drops saves from unmount cleanup).
   * - Always sets loadedRevisionId = revisionId.
   * - If the revision is HEAD: sets editableRevisionId = revisionId.
   * - If historical: sets editableRevisionId = null (next edit forks a new draft).
   */
  requestRevisionLoad: (revisionId: string) => Promise<void>
  /**
   * Load an artifact into the editor, mounting its current/last revision when one
   * exists or an empty editor state when it does not.
   */
  requestArtifactLoad: (artifactId: string) => Promise<void>
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
   * Load lightweight artifact/revision metadata for every revision anchor visible
   * in the thread. Cached revisions are skipped so chat can call this after each
   * message update without causing repeated database work.
   */
  loadArtifactRevisionMetas: (
    references: ArtifactRevisionMetaReference[]
  ) => Promise<void>
  /**
   * Look up artifact and revision metadata by artifact ID.
   * Returns null if the artifact/revision is not loaded into the editor or thread metadata cache.
   * @param artifactId - must match the currently loaded artifact
   * @param options.revisionId - specific revision to return; defaults to head revision
   * @param options.includeContent - include revision content in result (default: false)
   */
  getArtifactRevisionMeta: (
    artifactId: string,
    options?: ArtifactRevisionMetaOptions
  ) => ArtifactRevisionMeta | null
  // Internal helpers — not for direct use outside the store
  _createUserDraft: (content: string) => Promise<ArtifactRevision>
  _persistToHead: (content: string) => Promise<void>
  _createDraftThenPersist: (content: string) => Promise<void>
  _syncToDiskIfLinked: (content: string) => Promise<void>
  _sealDraftInPlace: (messageId: string) => Promise<SealResult>
  _reuseLastSealed: () => SealResult | null
  _createSealedRevision: (messageId: string) => Promise<SealResult>
  _reuseCurrentHead: () => SealResult | null
  /**
   * Set editor-relevant state and transition to 'ready'.
   * Shared between loadForConversation and requestRevisionLoad.
   * - loadedRevisionId always tracks the mounted revision.
   * - isHead=true  → editableRevisionId = revision.id (editor persists to this revision)
   * - isHead=false → editableRevisionId = null (next save forks a new draft)
   */
  _mountRevision: (revision: ArtifactRevision | null, isHead: boolean) => void
}

const INITIAL_STATE: ArtifactState = {
  status: 'loading',
  artifact: null,
  headRevision: null,
  loadedRevisionId: null,
  editableRevisionId: null,
  loadedContent: '',
  editorKey: null,
  revisions: [],
  artifactRevisionMetaByRevisionId: {},
  isSaving: false,
  saveError: null,
  externalChangeDetected: false,
}

function toRevisionSummary(
  revision: ArtifactRevision
): ArtifactRevisionSummary {
  const { content: _content, ...summary } = revision
  return summary
}

function buildRevisionMeta(
  artifact: Artifact,
  revision: ArtifactRevision
): ArtifactRevisionMeta {
  return {
    artifact,
    revision: toRevisionSummary(revision),
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useArtifactStore = create<ArtifactState & ArtifactActions>(
  (set, get) => ({
    ...INITIAL_STATE,

    // ── Lifecycle ───────────────────────────────────────────────────────────────

    reset() {
      set(INITIAL_STATE)
    },

    /**
     * Loads or creates the active artifact for a conversation. This store owns artifact
     * and revision state only; callers coordinate message/thread state separately.
     */
    async loadForConversation(conversationId) {
      console_if('ARTIFACT_STORE').log('[ARTIFACT_STORE] load:start', {
        conversationId,
      })
      set({ ...INITIAL_STATE, status: 'loading' })

      try {
        const [artifacts, conversation] = await Promise.all([
          listArtifacts(conversationId),
          getConversation(conversationId),
        ])
        let artifact: Artifact

        if (artifacts.length === 0) {
          // No artifact yet — create one, but do NOT create a revision.
          // The editor will start empty; the first save creates the initial revision.
          const artifactId = await createArtifact({
            conversation_id: conversationId,
          })
          await setConversationActiveArtifact(conversationId, artifactId)
          artifact = (await getArtifact(artifactId))!
        } else {
          artifact =
            artifacts.find((a) => a.id === conversation?.active_artifact_id) ??
            artifacts.reduce((prev, cur) =>
              cur.updated_at > prev.updated_at ? cur : prev
            )
        }

        const revisions = await listRevisions(artifact.id)
        // listRevisions returns DESC, reverse to get ASC for store
        const revisionsAsc = [...revisions].reverse()

        const headRevision = artifact.current_revision_id
          ? (revisionsAsc.find((r) => r.id === artifact.current_revision_id) ??
            revisionsAsc[revisionsAsc.length - 1] ??
            null)
          : (revisionsAsc[revisionsAsc.length - 1] ?? null)

        set({
          artifact,
          headRevision,
          revisions: revisionsAsc,
          artifactRevisionMetaByRevisionId: Object.fromEntries(
            revisionsAsc.map((revision) => [
              revision.id,
              buildRevisionMeta(artifact, revision),
            ])
          ),
        })
        get()._mountRevision(headRevision, true)
        console_if('ARTIFACT_STORE').log('[ARTIFACT_STORE] load:ready', {
          conversationId,
          artifactId: artifact.id,
          headRevisionId: headRevision?.id ?? null,
          revisionCount: revisionsAsc.length,
        })

        if (artifact.file_path) {
          get().checkExternalChange()
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load artifact'
        console.error('[artifactStore] loadForConversation error:', message)
        set({ status: 'error' })
      }
    },

    // ── Internal helpers ────────────────────────────────────────────────────────

    /**
     * Mounts a revision into editor-facing state. A non-head revision intentionally
     * clears editability so the next save forks into a user draft.
     */
    _mountRevision(revision, isHead) {
      // editorKey serves as new revision ID for an unsaved draft
      // when saving with revisionId == null → new revision gets editorKey as ID
      // no re-render on draft persist
      let newRevisionId = crypto.randomUUID()

      set({
        loadedRevisionId: revision?.id ?? null,
        editableRevisionId: isHead ? (revision?.id ?? null) : null,
        loadedContent: revision?.content ?? '',
        editorKey: revision
          ? isHead
            ? revision.id
            : newRevisionId
          : newRevisionId,
        status: 'ready',
      })
      console_if('ARTIFACT_STORE').log('[ARTIFACT_STORE] revision:mounted', {
        revisionId: revision?.id ?? null,
        isHead,
      })
    },

    /**
     * Creates a user-owned draft revision and marks it as the artifact head. This
     * method does not create chat messages.
     */
    async _createUserDraft(content: string): Promise<ArtifactRevision> {
      const { artifact, revisions, editorKey } = get()
      if (!artifact) throw new Error('No active artifact')

      // Only use editorKey as the pre-allocated ID when it is a truly fresh UUID
      // (not the ID of an existing revision). If editorKey matches an existing revision
      // (e.g. head was sealed since mount, editorKey still points to it), a fresh UUID
      // is generated instead to avoid a UNIQUE constraint violation on INSERT.
      const keyIsFresh = editorKey && !revisions.some((r) => r.id === editorKey)
      const revisionId = await createRevision({
        artifact_id: artifact.id,
        author: 'user',
        content,
        id: keyIsFresh ? editorKey : undefined,
      })
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

      const updatedArtifact = {
        ...artifact,
        current_revision_id: revisionId,
        updated_at: Date.now(),
      }
      set({
        artifact: updatedArtifact,
        headRevision: newRevision,
        loadedRevisionId: revisionId,
        editableRevisionId: revisionId,
        loadedContent: content,
        revisions: [...revisions, newRevision],
        artifactRevisionMetaByRevisionId: {
          ...get().artifactRevisionMetaByRevisionId,
          [revisionId]: buildRevisionMeta(updatedArtifact, newRevision),
        },
      })

      return newRevision
    },

    // ── Save chain ──────────────────────────────────────────────────────────────

    /**
     * Persists editor content into the active artifact. Guards transition saves and
     * concurrent saves, then routes through the draft/head copy-on-write rules.
     */
    async save(content) {
      const {
        status,
        editableRevisionId,
        headRevision,
        isSaving,
        artifact,
        revisions,
        loadedContent,
      } = get()

      console_if('ARTIFACT_STORE').log('[ARTIFACT_STORE] save:requested', {
        status,
        isSaving,
        artifactId: artifact?.id ?? null,
        editableRevisionId,
        headRevisionId: headRevision?.id ?? null,
      })
      // Guard: drop saves during loading transitions (e.g. from editor unmount cleanup)
      if (status !== 'ready') return

      // Guard: concurrent save already in flight
      if (isSaving) return

      // Guard: no artifact to save to
      if (!artifact) return

      // Guard: empty editor updates should not create revisions
      if (content.trim() === '') return

      // Guard: unchanged editor updates should not rewrite or fork revisions
      if (content === loadedContent) return

      set({ isSaving: true, saveError: null })
      try {
        // begin actual save
        console_if('ARTIFACT_STORE').log('[ARTIFACT_STORE] save:branch', {
          editableRevisionId,
          revisionCount: revisions.length,
          headRevisionId: headRevision?.id ?? null,
          canEditHead: headRevision ? canEditInPlace(headRevision) : false,
        })

        if (editableRevisionId === null) {
          await get()._createUserDraft(content)
        } else if (
          editableRevisionId === headRevision?.id &&
          canEditInPlace(headRevision)
        ) {
          // HEAD is a user draft — persist in place
          await get()._persistToHead(content)
        } else if (editableRevisionId === headRevision?.id) {
          // HEAD is sealed — copy-on-write: create new draft
          await get()._createDraftThenPersist(content)
        } else {
          // editableRevisionId doesn't match head — shouldn't happen in normal flow,
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

    /**
     * Updates the editable user draft in place and mirrors linked-file content when
     * the artifact is disk-backed.
     */
    async _persistToHead(content: string) {
      const { headRevision } = get()
      console_if('ARTIFACT_STORE').log('[ARTIFACT_STORE] save:persist-head', {
        headRevisionId: headRevision?.id ?? null,
      })
      if (!headRevision) return

      await updateRevisionContent(headRevision.id, content)
      set((s) => ({
        headRevision: s.headRevision
          ? { ...s.headRevision, content, updated_at: Date.now() }
          : null,
        loadedContent: content,
        revisions: s.revisions.map((r) =>
          r.id === headRevision.id
            ? { ...r, content, updated_at: Date.now() }
            : r
        ),
        artifactRevisionMetaByRevisionId:
          s.artifact && s.artifactRevisionMetaByRevisionId[headRevision.id]
            ? {
                ...s.artifactRevisionMetaByRevisionId,
                [headRevision.id]: buildRevisionMeta(s.artifact, {
                  ...headRevision,
                  content,
                  updated_at: Date.now(),
                }),
              }
            : s.artifactRevisionMetaByRevisionId,
      }))

      await get()._syncToDiskIfLinked(content)
    },

    /**
     * Creates a fresh user draft for edits that cannot safely mutate the loaded
     * revision, then syncs disk content if linked.
     */
    async _createDraftThenPersist(content: string) {
      // _createUserDraft sets loadedRevisionId/editableRevisionId to the new draft's id
      await get()._createUserDraft(content)
      await get()._syncToDiskIfLinked(content)
    },

    /**
     * Writes the latest content to a linked file and stores the new hash. Disk sync
     * errors are surfaced as saveError without rolling back the in-memory revision.
     */
    async _syncToDiskIfLinked(content: string) {
      const { artifact } = get()
      if (!artifact?.file_path) return

      try {
        await invoke('write_file', { path: artifact.file_path, content })
        const hash = await invoke<string>('hash_file_content', { content })
        await updateArtifact(artifact.id, { file_hash: hash })
        set((s) => ({
          artifact: s.artifact ? { ...s.artifact, file_hash: hash } : null,
        }))
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
    async sealForSend(messageId) {
      const {
        editableRevisionId,
        headRevision,
        loadedRevisionId,
        revisions,
        artifact,
      } = get()
      if (!headRevision || !artifact) return null

      const loadedRevision = loadedRevisionId
        ? revisions.find((r) => r.id === loadedRevisionId)
        : null
      if (
        editableRevisionId === null &&
        loadedRevision &&
        loadedRevision.id !== headRevision.id
      ) {
        return {
          artifactId: artifact.id,
          revisionId: loadedRevision.id,
          content: loadedRevision.content,
        }
      }

      const isDraft = canEditInPlace(headRevision)
      const changed = hasContentChangedSinceLastSeal(headRevision, revisions)
      console_if('ARTIFACT_STORE').log('[ARTIFACT_STORE] seal:branch', {
        artifactId: artifact.id,
        headRevisionId: headRevision.id,
        loadedRevisionId,
        editableRevisionId,
        isDraft,
        changed,
      })

      if (isDraft && changed) {
        return get()._sealDraftInPlace(messageId)
      } else if (isDraft && !changed) {
        return get()._reuseLastSealed()
      } else if (!isDraft && changed) {
        return get()._createSealedRevision(messageId)
      } else {
        return get()._reuseCurrentHead()
      }
    },

    /**
     * Seals the current user draft by linking it to the user message that is being
     * submitted.
     */
    async _sealDraftInPlace(messageId): Promise<SealResult> {
      const { headRevision, artifact } = get()
      if (!headRevision || !artifact) throw new Error('No active revision')

      await sealRevision(headRevision.id, messageId)
      const sealed = { ...headRevision, message_id: messageId }
      set((s) => ({
        headRevision: sealed,
        revisions: s.revisions.map((r) =>
          r.id === headRevision.id ? sealed : r
        ),
        artifactRevisionMetaByRevisionId: {
          ...s.artifactRevisionMetaByRevisionId,
          [sealed.id]: buildRevisionMeta(artifact, sealed),
        },
      }))

      return {
        artifactId: artifact.id,
        revisionId: headRevision.id,
        content: headRevision.content,
      }
    },

    /**
     * Reuses the latest sealed revision when the active draft has no new content.
     * This avoids producing duplicate chat anchors for unchanged content.
     */
    _reuseLastSealed(): SealResult | null {
      const { revisions, headRevision, artifact } = get()
      if (!artifact) return null
      const lastSealed = findLastSealedRevision(revisions)
      const target = lastSealed ?? headRevision
      if (!target) return null
      set({
        loadedRevisionId: target.id,
        editableRevisionId: target.id === headRevision?.id ? target.id : null,
      })
      return {
        artifactId: artifact.id,
        revisionId: target.id,
        content: target.content,
      }
    },

    /**
     * Creates and seals a new user revision when the current head is sealed but its
     * content has changed in memory.
     */
    async _createSealedRevision(messageId): Promise<SealResult> {
      const { headRevision, artifact, revisions } = get()
      if (!headRevision || !artifact) throw new Error('No active revision')

      const revisionId = await createRevision({
        artifact_id: artifact.id,
        author: 'user',
        content: headRevision.content,
      })
      await sealRevision(revisionId, messageId)
      await updateArtifact(artifact.id, { current_revision_id: revisionId })

      const newRevision: ArtifactRevision = {
        id: revisionId,
        artifact_id: artifact.id,
        message_id: messageId,
        author: 'user',
        content: headRevision.content,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      const updatedArtifact = {
        ...artifact,
        current_revision_id: revisionId,
        updated_at: Date.now(),
      }
      set({
        artifact: updatedArtifact,
        headRevision: newRevision,
        loadedRevisionId: revisionId,
        editableRevisionId: revisionId,
        revisions: [...revisions, newRevision],
        artifactRevisionMetaByRevisionId: {
          ...get().artifactRevisionMetaByRevisionId,
          [revisionId]: buildRevisionMeta(updatedArtifact, newRevision),
        },
      })

      return {
        artifactId: artifact.id,
        revisionId,
        content: headRevision.content,
      }
    },

    /**
     * Returns the current head revision when no sealing work is needed.
     */
    _reuseCurrentHead(): SealResult | null {
      const { headRevision, artifact } = get()
      if (!headRevision || !artifact) return null
      return {
        artifactId: artifact.id,
        revisionId: headRevision.id,
        content: headRevision.content,
      }
    },

    /**
     * Builds artifact context for an outgoing message without changing the active
     * editor artifact. Current editor context still uses the seal chain so draft
     * content and historical revision selection are preserved.
     */
    async getArtifactContextForSend(artifactId, messageId) {
      const currentArtifact = get().artifact
      if (currentArtifact?.id === artifactId) {
        return get().sealForSend(messageId)
      }

      const targetArtifact = await getArtifact(artifactId)
      if (!targetArtifact) return null

      const revision = targetArtifact.current_revision_id
        ? await getRevision(targetArtifact.current_revision_id)
        : ((await listRevisions(targetArtifact.id))[0] ?? null)

      if (!revision) return null

      return {
        artifactId: targetArtifact.id,
        revisionId: revision.id,
        content: revision.content,
      }
    },

    // ── External triggers ────────────────────────────────────────────────────────

    /**
     * Applies sidecar-generated artifact content as a sealed AI revision linked to
     * the assistant message that produced it. Non-active targets are persisted but
     * do not change the editor selection.
     */
    async applyAiRevision(content: string, messageId, artifactId) {
      const { artifact, revisions } = get()
      const targetArtifactId = artifactId ?? artifact?.id
      if (!targetArtifactId) return

      const isActiveArtifact = artifact?.id === targetArtifactId
      const targetArtifact =
        isActiveArtifact && artifact
          ? artifact
          : await getArtifact(targetArtifactId)

      if (!targetArtifact) return

      const revisionId = await createRevision({
        artifact_id: targetArtifact.id,
        author: 'ai',
        content,
      })
      await sealRevision(revisionId, messageId)
      await updateArtifact(targetArtifact.id, {
        current_revision_id: revisionId,
      })

      const now = Date.now()

      const newRevision: ArtifactRevision = {
        id: revisionId,
        artifact_id: targetArtifact.id,
        message_id: messageId,
        author: 'ai',
        content,
        created_at: now,
        updated_at: now,
      }

      const updatedArtifact = {
        ...targetArtifact,
        current_revision_id: revisionId,
        updated_at: now,
      }

      if (!isActiveArtifact) {
        set({
          artifactRevisionMetaByRevisionId: {
            ...get().artifactRevisionMetaByRevisionId,
            [revisionId]: buildRevisionMeta(updatedArtifact, newRevision),
          },
        })
        console_if('ARTIFACT_STORE').log(
          '[ARTIFACT_STORE] ai-revision:applied',
          {
            artifactId: targetArtifact.id,
            revisionId,
          }
        )
        return
      }

      set({
        artifact: updatedArtifact,
        headRevision: newRevision,
        loadedRevisionId: revisionId,
        editableRevisionId: revisionId,
        loadedContent: content,
        editorKey: revisionId,
        revisions: [...revisions, newRevision],
        artifactRevisionMetaByRevisionId: {
          ...get().artifactRevisionMetaByRevisionId,
          [revisionId]: buildRevisionMeta(updatedArtifact, newRevision),
        },
      })
      console_if('ARTIFACT_STORE').log('[ARTIFACT_STORE] ai-revision:applied', {
        artifactId: targetArtifact.id,
        revisionId,
      })
    },

    /**
     * Loads a revision into editor state. If the revision belongs to a different
     * artifact, that artifact and its revision list become active first.
     */
    async requestRevisionLoad(revisionId) {
      console_if('ARTIFACT_STORE').log('[ARTIFACT_STORE] revision-load:start', {
        revisionId,
      })
      // Set loading — any saves fired by editor unmount cleanup will be dropped
      set({ status: 'loading' })

      // Yield to let React commit the loading state (editor unmounts, cleanup saves are dropped)
      await new Promise<void>((resolve) => setTimeout(resolve, 0))

      const { revisions: currentRevisions, artifact: currentArtifact } = get()

      const revision =
        currentRevisions.find((r) => r.id === revisionId) ??
        (await getRevision(revisionId))
      if (!revision) {
        set({ status: 'ready' })
        return
      }

      // If the revision belongs to a different artifact, load that artifact's full context first
      if (revision.artifact_id !== currentArtifact?.id) {
        const targetArtifact = await getArtifact(revision.artifact_id)
        if (!targetArtifact) {
          set({ status: 'ready' })
          return
        }

        const allRevisions = await listRevisions(targetArtifact.id)
        const revisionsAsc = [...allRevisions].reverse()
        const targetHead = targetArtifact.current_revision_id
          ? (revisionsAsc.find(
              (r) => r.id === targetArtifact.current_revision_id
            ) ??
            revisionsAsc[revisionsAsc.length - 1] ??
            null)
          : (revisionsAsc[revisionsAsc.length - 1] ?? null)

        set({
          artifact: targetArtifact,
          headRevision: targetHead,
          revisions: revisionsAsc,
          artifactRevisionMetaByRevisionId: {
            ...get().artifactRevisionMetaByRevisionId,
            ...Object.fromEntries(
              revisionsAsc.map((targetRevision) => [
                targetRevision.id,
                buildRevisionMeta(targetArtifact, targetRevision),
              ])
            ),
          },
        })
        await setConversationActiveArtifact(
          targetArtifact.conversation_id,
          targetArtifact.id
        )
      }

      const { headRevision } = get()
      const isHead = revisionId === headRevision?.id
      get()._mountRevision(revision, isHead)
    },

    /**
     * Loads an artifact and mounts its current revision. Empty artifacts are shown
     * as editable blank documents so users can switch back to freshly created items.
     */
    async requestArtifactLoad(artifactId) {
      console_if('ARTIFACT_STORE').log('[ARTIFACT_STORE] artifact-load:start', {
        artifactId,
      })
      set({ status: 'loading' })

      await new Promise<void>((resolve) => setTimeout(resolve, 0))

      const currentArtifact = get().artifact
      const targetArtifact =
        currentArtifact?.id === artifactId
          ? currentArtifact
          : await getArtifact(artifactId)

      if (!targetArtifact) {
        set({ status: 'ready' })
        return
      }

      const allRevisions = await listRevisions(targetArtifact.id)
      const revisionsAsc = [...allRevisions].reverse()
      const targetHead = targetArtifact.current_revision_id
        ? (revisionsAsc.find(
            (r) => r.id === targetArtifact.current_revision_id
          ) ??
          revisionsAsc[revisionsAsc.length - 1] ??
          null)
        : (revisionsAsc[revisionsAsc.length - 1] ?? null)

      set({
        artifact: targetArtifact,
        headRevision: targetHead,
        revisions: revisionsAsc,
        artifactRevisionMetaByRevisionId: {
          ...get().artifactRevisionMetaByRevisionId,
          ...Object.fromEntries(
            revisionsAsc.map((targetRevision) => [
              targetRevision.id,
              buildRevisionMeta(targetArtifact, targetRevision),
            ])
          ),
        },
      })

      await setConversationActiveArtifact(
        targetArtifact.conversation_id,
        targetArtifact.id
      )
      get()._mountRevision(targetHead, true)

      if (targetArtifact.file_path) {
        get().checkExternalChange()
      }
    },

    /**
     * Creates a new empty artifact for the conversation and makes it the active
     * editor target without creating an initial revision.
     */
    async createNewArtifact(conversationId) {
      const artifactId = await createArtifact({
        conversation_id: conversationId,
      })
      await setConversationActiveArtifact(conversationId, artifactId)
      const artifact = (await getArtifact(artifactId))!

      set({
        artifact,
        headRevision: null,
        loadedRevisionId: null,
        editableRevisionId: null,
        loadedContent: '',
        editorKey: crypto.randomUUID(),
        revisions: [],
        artifactRevisionMetaByRevisionId: {},
        status: 'ready',
      })
    },

    /**
     * Renames the active artifact title. Empty strings are stored as null so the UI
     * can consistently render the Untitled fallback.
     */
    async rename(title) {
      const { artifact } = get()
      if (!artifact) return
      const effectiveTitle = title && title.trim() !== '' ? title.trim() : null
      await updateArtifact(artifact.id, { title: effectiveTitle })
      const updatedArtifact = { ...artifact, title: effectiveTitle }
      set((s) => ({
        artifact: s.artifact ? updatedArtifact : null,
        artifactRevisionMetaByRevisionId: Object.fromEntries(
          Object.entries(s.artifactRevisionMetaByRevisionId).map(
            ([revisionId, meta]) => [
              revisionId,
              meta.artifact.id === artifact.id
                ? { ...meta, artifact: updatedArtifact }
                : meta,
            ]
          )
        ),
      }))
    },

    // ── File sync ────────────────────────────────────────────────────────────────

    /**
     * Checks whether the linked disk file diverged from the last stored artifact hash.
     */
    async checkExternalChange() {
      const { artifact } = get()
      if (!artifact?.file_path || !artifact.file_hash) return

      try {
        const diskHash = await invoke<string>('hash_file', {
          path: artifact.file_path,
        })
        if (diskHash !== artifact.file_hash) {
          set({ externalChangeDetected: true })
        }
      } catch {
        // File may not exist yet — ignore
      }
    },

    /**
     * Imports linked disk content into a new user draft and remounts the editor with
     * that draft.
     */
    async reloadFromDisk() {
      const { artifact } = get()
      if (!artifact?.file_path) return

      set({ status: 'loading' })
      await new Promise<void>((resolve) => setTimeout(resolve, 0))

      const content = await invoke<string>('read_file', {
        path: artifact.file_path,
      })
      const newDraft = await get()._createUserDraft(content)
      set({
        externalChangeDetected: false,
        loadedContent: content,
        editorKey: newDraft.id,
        status: 'ready',
      })
    },

    /**
     * Loads missing thread revision metadata in a small deduped batch. The cache is
     * keyed by revision ID; loaded/current revisions are added to the same cache
     * by save, rename, load, and AI-apply paths.
     */
    async loadArtifactRevisionMetas(references) {
      const uniqueReferences = new Map<string, ArtifactRevisionMetaReference>()
      for (const reference of references) {
        uniqueReferences.set(reference.revisionId, reference)
      }

      const missingReferences = [...uniqueReferences.values()].filter(
        (reference) => {
          const cached =
            get().artifactRevisionMetaByRevisionId[reference.revisionId]
          return !cached || cached.artifact.id !== reference.artifactId
        }
      )
      if (missingReferences.length === 0) return

      const artifactLoads = new Map<string, Promise<Artifact | null>>()
      const loadArtifactForRevision = (artifactId: string) => {
        const loadedArtifact = get().artifact
        if (loadedArtifact?.id === artifactId) {
          return Promise.resolve(loadedArtifact)
        }
        const existingLoad = artifactLoads.get(artifactId)
        if (existingLoad) return existingLoad
        const nextLoad = getArtifact(artifactId)
        artifactLoads.set(artifactId, nextLoad)
        return nextLoad
      }

      const loadedMetas = await Promise.all(
        missingReferences.map(async (reference) => {
          const revision =
            get().revisions.find((r) => r.id === reference.revisionId) ??
            (await getRevision(reference.revisionId))
          if (!revision) return null

          const revisionArtifact = await loadArtifactForRevision(
            revision.artifact_id
          )
          if (!revisionArtifact) return null

          return [
            revision.id,
            buildRevisionMeta(revisionArtifact, revision),
          ] as const
        })
      )

      const nextMetas = Object.fromEntries(
        loadedMetas.filter((meta): meta is NonNullable<typeof meta> =>
          Boolean(meta)
        )
      )
      if (Object.keys(nextMetas).length === 0) return

      set((s) => ({
        artifactRevisionMetaByRevisionId: {
          ...s.artifactRevisionMetaByRevisionId,
          ...nextMetas,
        },
      }))
    },

    /**
     * Looks up metadata from the active editor state first, then from the thread
     * metadata cache. Revision content is omitted by default so chat cards can
     * inspect metadata without subscribing to large text.
     */
    getArtifactRevisionMeta(artifactId, options = {}) {
      const {
        artifact,
        headRevision,
        revisions,
        artifactRevisionMetaByRevisionId,
      } = get()

      const { revisionId, includeContent = false } = options
      let revision: ArtifactRevision | undefined

      if (artifact?.id === artifactId) {
        if (revisionId) {
          revision = revisions.find((r) => r.id === revisionId)
        } else {
          revision = headRevision ?? undefined
        }

        if (revision) {
          const revisionOut = includeContent
            ? revision
            : toRevisionSummary(revision)
          return { artifact, revision: revisionOut }
        }
      }

      if (!revisionId) return null

      const cached = artifactRevisionMetaByRevisionId[revisionId]
      if (!cached || cached.artifact.id !== artifactId) return null
      return cached
    },

    /**
     * Links the current artifact revision to a workspace file and records its hash for
     * later external-change detection.
     */
    async linkToDisk(relativePath) {
      const { artifact, headRevision } = get()
      if (!artifact || !headRevision) return

      const content = headRevision.content
      await invoke('write_file', { path: relativePath, content })
      const hash = await invoke<string>('hash_file_content', { content })
      await updateArtifact(artifact.id, {
        file_path: relativePath,
        file_hash: hash,
      })
      set((s) => ({
        artifact: s.artifact
          ? { ...s.artifact, file_path: relativePath, file_hash: hash }
          : null,
        artifactRevisionMetaByRevisionId: s.artifact
          ? Object.fromEntries(
              Object.entries(s.artifactRevisionMetaByRevisionId).map(
                ([revisionId, meta]) => [
                  revisionId,
                  meta.artifact.id === s.artifact?.id
                    ? {
                        ...meta,
                        artifact: {
                          ...meta.artifact,
                          file_path: relativePath,
                          file_hash: hash,
                        },
                      }
                    : meta,
                ]
              )
            )
          : s.artifactRevisionMetaByRevisionId,
      }))
    },
  })
)

// Convenience accessor without subscribing to state — for use in non-React code (e.g. sidecar store)
export const getArtifactStore = () => useArtifactStore.getState()
