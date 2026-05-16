import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useAppStore } from './app/appStore'
import { startWindowSizePersistence, currentWindowLabel } from './lib/windows'

export default function App() {
  const init = useAppStore((s) => s.init)

  useEffect(() => {
    init()
    if (currentWindowLabel() === 'main') {
      startWindowSizePersistence()
    }
  }, [])

  return <RouterProvider router={router} />
}
