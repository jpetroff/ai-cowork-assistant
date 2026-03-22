import { create } from 'zustand'
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} from '@/lib/db/repositories/projects'
import type { Project } from '@/lib/db/types'

type ProjectUpdateData = Partial<Pick<Project, 'name' | 'folder_path'>>
import { useNotificationStore } from './notificationStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Operation in progress on a specific project ID. */
export type ProjectOp = 'renaming' | 'deleting'

interface ProjectState {
  projects: Project[]
  activeProjectId: string | null
  status: StoreStatus
  error: string | null
  /** Maps project ID → in-flight operation kind. Card is disabled while set. */
  operationStates: Record<string, ProjectOp>
}

interface ProjectActions {
  /**
   * Load all projects from SQLite. Called by the home route loader.
   * Transitions status: idle → loading → ready | error
   */
  loadAll: () => Promise<void>
  /**
   * Create a new project named "New project" with no folder assigned.
   * Returns the new Project on success. Caller is responsible for navigation.
   * Pushes an error notification on failure.
   */
  create: () => Promise<Project | null>
  /**
   * Rename a project. DB-first: sets operationStates[id]='renaming' before writing.
   * Clears the operation state on both success and failure.
   * Pushes an error notification on failure.
   */
  rename: (id: string, name: string) => Promise<void>
  /**
   * Delete a project. DB-first: sets operationStates[id]='deleting' before writing.
   * Guards against concurrent deletes for the same ID.
   * Pushes an error notification on failure.
   */
  delete: (id: string) => Promise<void>
  /**
   * Update project fields (e.g. folder_path). DB-first.
   * Pushes an error notification on failure.
   */
  update: (id: string, data: ProjectUpdateData) => Promise<void>
  /** Set the active project ID (used when navigating into a project). */
  setActive: (id: string) => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectState & ProjectActions>((set, get) => ({
  projects: [],
  activeProjectId: null,
  status: 'idle',
  error: null,
  operationStates: {},

  async loadAll() {
    set({ status: 'loading', error: null })
    try {
      const projects = await listProjects()
      set({ projects, status: 'ready' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load projects'
      set({ status: 'error', error: message })
    }
  },

  async create() {
    try {
      const id = await createProject({ name: 'New project' })
      const project: Project = {
        id,
        name: 'New project',
        folder_path: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }
      set((s) => ({ projects: [project, ...s.projects] }))
      return project
    } catch (err) {
      useNotificationStore.getState().push({
        kind: 'error',
        message: 'Could not create project',
        detail: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  },

  async rename(id, name) {
    const { operationStates } = get()
    // Guard: don't start if a different operation is already running on this ID
    if (operationStates[id]) return

    set((s) => ({ operationStates: { ...s.operationStates, [id]: 'renaming' } }))
    try {
      await updateProject(id, { name })
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, name, updated_at: Date.now() } : p)),
        operationStates: omit(s.operationStates, id),
      }))
    } catch (err) {
      set((s) => ({ operationStates: omit(s.operationStates, id) }))
      useNotificationStore.getState().push({
        kind: 'error',
        message: `Could not rename project`,
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  },

  async delete(id) {
    const { operationStates } = get()
    // Guard against concurrent deletes
    if (operationStates[id]) return

    set((s) => ({ operationStates: { ...s.operationStates, [id]: 'deleting' } }))
    try {
      await deleteProject(id)
      set((s) => ({
        projects: s.projects.filter((p) => p.id !== id),
        operationStates: omit(s.operationStates, id),
      }))
    } catch (err) {
      set((s) => ({ operationStates: omit(s.operationStates, id) }))
      useNotificationStore.getState().push({
        kind: 'error',
        message: 'Could not delete project',
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  },

  async update(id, data) {
    try {
      await updateProject(id, data)
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === id ? { ...p, ...data, updated_at: Date.now() } : p
        ),
      }))
    } catch (err) {
      useNotificationStore.getState().push({
        kind: 'error',
        message: 'Could not update project',
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  },

  setActive(id) {
    set({ activeProjectId: id })
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  const { [key]: _, ...rest } = obj
  return rest as T
}
