import { create } from 'zustand'
import { listArtifacts, createArtifact, updateArtifact } from '@/lib/db/repositories/documents'
import { createRevision, getHeadRevision, updateRevisionContent } from '@/lib/db/repositories/revisions'
import type { Artifact, ArtifactRevision } from '@/lib/db/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ArtifactState {
  artifacts: Artifact[]
  activeArtifactId: string | null
  activeArtifact: Artifact | null
  headRevision: ArtifactRevision | null
  conversationId: string | null
  status: StoreStatus
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: number | null
  // TODO: stub fields for file-link-to-disk (FR-EDT-010, FR-EDT-011)
  linkedFilePath: string | null
  externalFileModified: boolean
}

interface ArtifactActions {
  /**
   * Load artifacts for a conversation. Activates most-recently-updated artifact
   * and loads its HEAD revision. Creates an initial empty artifact if none found.
   */
  loadForConversation: (id: string) => Promise<void>
  /**
   * Optimistically update head revision content in store, mark dirty,
   * and schedule a 1-second debounced auto-save.
   */
  updateContent: (content: string) => void
  /**
   * Persist the active artifact's HEAD revision content to SQLite immediately.
   */
  saveNow: () => Promise<void>
  /**
   * Rename the active artifact title.
   */
  rename: (title: string | null) => Promise<void>
  /** @stub FR-EDT-010 */
  linkToFile: (path: string) => void
  /** @stub FR-EDT-010 */
  unlinkFile: () => void
  /** @stub FR-EDT-011 */
  checkExternalChanges: () => void
  /** @stub FR-EDT-011 */
  reloadFromDisk: () => void
}

// Module-level debounce timer ref — survives re-renders
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

const INITIAL_STATE: ArtifactState = {
  artifacts: [],
  activeArtifactId: null,
  activeArtifact: null,
  headRevision: null,
  conversationId: null,
  status: 'idle',
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  linkedFilePath: null,
  externalFileModified: false,
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useArtifactStore = create<ArtifactState & ArtifactActions>((set, get) => ({
  ...INITIAL_STATE,

  async loadForConversation(id) {
    set({ status: 'loading', conversationId: id, artifacts: [], activeArtifact: null, activeArtifactId: null, headRevision: null })
    try {
      let artifacts = await listArtifacts(id)

      if (artifacts.length === 0) {
        // Safety net: create initial empty artifact + first revision if none found
        const artifactId = await createArtifact({ conversation_id: id })
        await createRevision({ artifact_id: artifactId, author: 'user', content: '' })
        artifacts = await listArtifacts(id)
      }

      // Activate most-recently-updated artifact
      const active = artifacts.reduce((prev, cur) => (cur.updated_at > prev.updated_at ? cur : prev))
      const headRevision = await getHeadRevision(active.id)
      set({ artifacts, activeArtifact: active, activeArtifactId: active.id, headRevision, status: 'ready' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load artifacts'
      console.error('[artifactStore] loadForConversation error:', message)
      set({ status: 'error' })
    }
  },

  updateContent(content) {
    const { headRevision } = get()
    if (!headRevision) return

    set((s) => ({
      isDirty: true,
      headRevision: s.headRevision ? { ...s.headRevision, content } : null,
    }))

    if (saveDebounceTimer !== null) clearTimeout(saveDebounceTimer)
    saveDebounceTimer = setTimeout(() => {
      saveDebounceTimer = null
      useArtifactStore.getState().saveNow()
    }, 1000)
  },

  async saveNow() {
    const { headRevision, isSaving, isDirty } = get()
    if (!headRevision || !isDirty) return
    if (isSaving) {
      if (saveDebounceTimer !== null) clearTimeout(saveDebounceTimer)
      saveDebounceTimer = setTimeout(() => {
        saveDebounceTimer = null
        useArtifactStore.getState().saveNow()
      }, 200)
      return
    }

    set({ isSaving: true })
    try {
      await updateRevisionContent(headRevision.id, headRevision.content)
      set({ isSaving: false, isDirty: false, lastSavedAt: Date.now() })
    } catch (err) {
      console.error('[artifactStore] saveNow error:', err instanceof Error ? err.message : err)
      set({ isSaving: false })
    }
  },

  async rename(title) {
    const { activeArtifact } = get()
    if (!activeArtifact) return
    const effectiveTitle = title && title.trim() !== '' ? title.trim() : null
    await updateArtifact(activeArtifact.id, { title: effectiveTitle })
    set((s) => ({
      activeArtifact: s.activeArtifact ? { ...s.activeArtifact, title: effectiveTitle } : null,
      artifacts: s.artifacts.map((a) =>
        a.id === activeArtifact.id ? { ...a, title: effectiveTitle } : a
      ),
    }))
  },

  linkToFile(_path) {
    // TODO: implement file-link-to-disk (FR-EDT-010)
  },

  unlinkFile() {
    // TODO: implement file-link-to-disk (FR-EDT-010)
  },

  checkExternalChanges() {
    // TODO: implement external change detection (FR-EDT-011)
  },

  reloadFromDisk() {
    // TODO: implement external change detection (FR-EDT-011)
  },
}))
