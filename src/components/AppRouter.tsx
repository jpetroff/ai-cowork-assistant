import { useEffect } from 'react'
import {
  createHashRouter,
  RouterProvider,
  useNavigate,
  useLocation,
  Outlet,
} from 'react-router-dom'
import { useConfigStore } from '@/stores/config-store'
import { SetupPage } from '@/pages/SetupPage'
import { Project } from '@/pages/Project'

function RootLayout() {
  const loadFromDb = useConfigStore((s) => s.loadFromDb)
  const { isConfigured, isHydrated } = useConfigStore()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    loadFromDb()
  }, [loadFromDb])

  useEffect(() => {
    if (!isHydrated) return
    if (location.pathname === '/app' && !isConfigured) {
      navigate('/', { replace: true })
    } else if (location.pathname === '/' && isConfigured) {
      navigate('/app', { replace: true })
    }
  }, [isHydrated, isConfigured, location.pathname, navigate])

  if (!isHydrated) {
    return (
      <div className='flex items-center justify-center p-4 text-muted-foreground text-sm'>
        Loading…
      </div>
    )
  }
  return <Outlet />
}

const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <SetupPage /> },
      { path: 'app', element: <Project /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
