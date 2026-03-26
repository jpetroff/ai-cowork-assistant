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
import { useMessageStore } from '@/stores/messageStore'
import { useArtifactStore } from '@/stores/artifactStore'

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

          // Fire independently — each section loads and renders with its own state
          void useMessageStore.getState().loadForConversation(chatId)
          void useArtifactStore.getState().loadForConversation(chatId)

          return null
        },
        element: <ChatPage />,
      },
    ],
  },
])
