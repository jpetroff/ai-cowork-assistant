import { createHashRouter, RouterProvider, Outlet } from 'react-router-dom'
import { rootLoader } from '@/loaders/root.loader'
import { LoaderPage } from '@/pages/LoaderPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { Project } from '@/pages/Project'

function RootLayout() {
  return <Outlet />
}

const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    loader: rootLoader,
    children: [
      { index: true, element: <LoaderPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'project/:projectId', element: <Project /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
