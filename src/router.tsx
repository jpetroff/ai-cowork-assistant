import { createHashRouter, Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingPage } from '@/pages/LoadingPage'
import { SetupPage } from '@/pages/SetupPage'
import { HomePage } from '@/pages/HomePage'
import { ProjectPage } from '@/pages/ProjectPage'
import { ChatPage } from '@/pages/ChatPage'
import { useProjectStore } from '@/stores/projectStore'
import { useConversationStore } from '@/stores/conversationStore'
import { useProjectSettingsStore } from '@/stores/projectSettingsStore'
import { useLlmProviderStore } from '@/stores/llmProviderStore'

export const router = createHashRouter([
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
        loader: ({ params }) => {
          useConversationStore.getState().setActive(params.chatId!)
          return null
        },
        element: <ChatPage />,
      },
    ],
  },
])
