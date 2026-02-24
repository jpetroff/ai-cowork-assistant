import { create } from 'zustand'
import * as chatsDb from '@/lib/chats'
import type { Chat } from '@/lib/chats'
import * as projectsDb from '@/lib/projects'
import type { Project } from '@/lib/projects'

export type ChatsStore = {
  chats: Chat[]
  projects: Project[]
  isLoading: boolean
  loadChats: (projectId: string) => Promise<void>
  loadProjects: () => Promise<void>
  renameChat: (id: string, name: string) => Promise<void>
  deleteChat: (id: string) => Promise<void>
  moveChatToProject: (id: string, newProjectId: string) => Promise<void>
}

export const useChatsStore = create<ChatsStore>((set, get) => ({
  chats: [],
  projects: [],
  isLoading: false,

  loadChats: async (projectId: string) => {
    set({ isLoading: true })
    try {
      const chats = await chatsDb.listByProject(projectId)
      set({ chats, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  loadProjects: async () => {
    try {
      const projects = await projectsDb.list()
      set({ projects })
    } catch {
      // Silently fail
    }
  },

  renameChat: async (id: string, name: string) => {
    // Optimistic update
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === id ? { ...c, name, updated_at: Date.now() } : c
      ),
    }))
    await chatsDb.rename(id, name)
  },

  deleteChat: async (id: string) => {
    // Optimistic update
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== id),
    }))
    await chatsDb.remove(id)
  },

  moveChatToProject: async (id: string, newProjectId: string) => {
    // Optimistic update
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== id),
    }))
    await chatsDb.moveToProject(id, newProjectId)
  },
}))
