import { createHashRouter, Outlet } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingPage } from '@/pages/LoadingPage'
import { SetupPage } from '@/pages/SetupPage'
import { HomePage } from '@/pages/HomePage'
import { ProjectPage } from '@/pages/ProjectPage'
import { ChatPage } from '@/pages/ChatPage'
import { useProjectStore } from '@/stores/projectStore'

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
          // TODO: projectStore.getState().setActive(params.projectId!)
          // TODO: conversationStore.getState().loadForProject(params.projectId!)
          void params
          return null
        },
        element: <ProjectPage />,
      },
      {
        path: 'projects/:projectId/chats/:chatId',
        loader: ({ params }) => {
          // TODO: conversationStore.getState().setActive(params.chatId!)
          // TODO: messageStore.getState().loadForConversation(params.chatId!)
          // TODO: artifactStore.getState().loadForConversation(params.chatId!)
          void params
          return null
        },
        element: <ChatPage />,
      },
    ],
  },
])
