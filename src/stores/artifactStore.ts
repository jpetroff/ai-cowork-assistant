import { create } from 'zustand'
import { listArtifacts, createArtifact, updateArtifact } from '@/lib/db/repositories/artifacts'
import type { Artifact } from '@/lib/db/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ArtifactState {
  artifacts: Artifact[]
  activeArtifactId: string | null
  activeArtifact: Artifact | null
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
   * Load artifacts for a conversation. Activates highest-version artifact.
   * Creates an initial empty artifact if none found (safety net).
   */
  loadForConversation: (id: string) => Promise<void>
  /**
   * Optimistically update active artifact content in store, mark dirty,
   * and schedule a 1-second debounced auto-save.
   */
  updateContent: (content: string) => void
  /**
   * Persist the active artifact's content to SQLite immediately.
   * Guards against concurrent saves with `isSaving` flag.
   */
  saveNow: () => Promise<void>
  /**
   * Rename the active artifact title.
   */
  rename: (title: string | null) => Promise<void>
  /**
   * Link active artifact to a file on disk.
   * TODO: implement file-link-to-disk (FR-EDT-010)
   */
  linkToFile: (path: string) => void
  /**
   * Unlink active artifact from disk file.
   * TODO: implement file-link-to-disk (FR-EDT-010)
   */
  unlinkFile: () => void
  /**
   * Check if linked file has been modified externally.
   * TODO: implement external change detection (FR-EDT-011)
   */
  checkExternalChanges: () => void
  /**
   * Reload artifact content from the linked disk file.
   * TODO: implement external change detection (FR-EDT-011)
   */
  reloadFromDisk: () => void
}

// Module-level debounce timer ref — survives re-renders
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null

const INITIAL_STATE: ArtifactState = {
  artifacts: [],
  activeArtifactId: null,
  activeArtifact: null,
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
    set({ status: 'loading', conversationId: id, artifacts: [], activeArtifact: null, activeArtifactId: null })
    try {
      let artifacts = await listArtifacts(id)

      if (artifacts.length === 0) {
        // Safety net: create initial empty artifact if none found
        const newId = await createArtifact({ conversation_id: id, version: 1, content: '' })
        const newArtifact: Artifact = {
          id: newId,
          conversation_id: id,
          message_id: null,
          title: null,
          content: '',
          file_path: null,
          file_hash: null,
          version: 1,
          created_at: Date.now(),
          updated_at: Date.now(),
        }
        artifacts = [newArtifact]
      }

      // Activate highest-version artifact
      const active = artifacts.reduce((prev, cur) => (cur.version > prev.version ? cur : prev))
      set({ artifacts, activeArtifact: active, activeArtifactId: active.id, status: 'ready' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load artifacts'
      console.error('[artifactStore] loadForConversation error:', message)
      set({ status: 'error' })
    }
  },

  updateContent(content) {
    const { activeArtifact } = get()
    if (!activeArtifact) return

    // Optimistic update in store
    set((s) => ({
      isDirty: true,
      activeArtifact: s.activeArtifact ? { ...s.activeArtifact, content } : null,
    }))

    // Debounced auto-save (1 second)
    if (saveDebounceTimer !== null) clearTimeout(saveDebounceTimer)
    saveDebounceTimer = setTimeout(() => {
      saveDebounceTimer = null
      useArtifactStore.getState().saveNow()
    }, 1000)
  },

  async saveNow() {
    const { activeArtifact, isSaving, isDirty } = get()
    if (!activeArtifact || !isDirty) return
    if (isSaving) {
      // Re-queue after current save completes
      if (saveDebounceTimer !== null) clearTimeout(saveDebounceTimer)
      saveDebounceTimer = setTimeout(() => {
        saveDebounceTimer = null
        useArtifactStore.getState().saveNow()
      }, 200)
      return
    }

    set({ isSaving: true })
    try {
      await updateArtifact(activeArtifact.id, { content: activeArtifact.content })
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
