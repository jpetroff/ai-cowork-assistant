import { createHashRouter, RouterProvider, Outlet } from 'react-router-dom'

const router = createHashRouter([
  {
    path: '/',
    children: [
      { index: true, element: <></> },
      { path: 'projects', element: <></> },
      { path: 'project/:projectId', element: <></> },
      { path: 'project/:projectId/chat/:chatId', element: <></> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
