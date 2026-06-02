import { createMemoryRouter, Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingPage } from '@/pages/LoadingPage'
import { SetupPage } from '@/pages/SetupPage'
import { HomePage } from '@/pages/HomePage'
import { ProjectPage } from '@/pages/ProjectPage'
import { ChatPage } from '@/pages/ChatPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { useProjectStore } from '@/components/projects/projectStore'
import { useConversationStore } from '@/components/conversations/conversationStore'
import { useProjectSettingsStore } from '@/components/projects/projectSettingsStore'
import { useLlmProviderStore } from '@/components/projects/llmProviderStore'
import { useChatSessionStore } from '@/components/chat/chatSessionStore'

export const router = createMemoryRouter([
  {
    path: '/',
    element: (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
    children: [
      { path: 'loading', element: <LoadingPage /> },
      { path: 'setup', element: <SetupPage /> },
      {
        path: 'settings',
        loader: () => useLlmProviderStore.getState().loadAll(),
        element: <SettingsPage />,
      },
      {
        index: true,
        loader: () => useProjectStore.getState().loadAll(),
        element: <HomePage />,
      },
      {
        path: 'projects/:projectId',
        loader: ({ params }) => {
          const projectId = params.projectId!
          useProjectStore.getState().setActive(projectId)
          return Promise.all([
            useConversationStore.getState().loadForProject(projectId),
            useProjectSettingsStore.getState().loadAiConfig(projectId),
            useLlmProviderStore.getState().loadAll(),
          ])
        },
        element: <ProjectPage />,
      },
      {
        path: 'projects/:projectId/chats/:chatId',
        loader: async ({ params }) => {
          const projectId = params.projectId!
          const chatId = params.chatId!

          // Guard for direct URL navigation — ensure project is active
          if (!useProjectStore.getState().activeProjectId) {
            useProjectStore.getState().setActive(projectId)
          }

          // Load conversations if not already loaded for this project
          if (useConversationStore.getState().activeProjectId !== projectId) {
            await useConversationStore.getState().loadForProject(projectId)
          }

          useConversationStore.getState().setActive(chatId)

          await Promise.all([
            useProjectSettingsStore.getState().loadAiConfig(projectId),
            useLlmProviderStore.getState().loadAll(),
          ])

          await useChatSessionStore.getState().loadChat({
            projectId,
            conversationId: chatId,
          })

          return null
        },
        element: <ChatPage />,
      },
    ],
  },
])
