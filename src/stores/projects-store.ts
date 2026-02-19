import { create } from 'zustand'
import * as projectsDb from '@/lib/projects'
import type { Project } from '@/lib/projects'

export type ProjectsStore = {
  projects: Project[]
  isLoading: boolean
  searchQuery: string
  loadProjects: () => Promise<void>
  createProject: (name: string) => Promise<string>
  deleteProject: (id: string) => Promise<void>
  renameProject: (id: string, name: string) => Promise<void>
  setSearchQuery: (query: string) => void
}

export const useProjectsStore = create<ProjectsStore>((set, get) => ({
  projects: [],
  isLoading: false,
  searchQuery: '',

  loadProjects: async () => {
    set({ isLoading: true })
    try {
      const projects = await projectsDb.list()
      set({ projects, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  createProject: async (name: string) => {
    const id = await projectsDb.insert({ name, output_folder: null })
    await get().loadProjects()
    return id
  },

  deleteProject: async (id: string) => {
    await projectsDb.remove(id)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    }))
  },

  renameProject: async (id: string, name: string) => {
    await projectsDb.rename(id, name)
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, name, updated_at: Date.now() } : p
      ),
    }))
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },
}))
