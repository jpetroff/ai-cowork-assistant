import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useAppStore } from './app/appStore'
import { useBackgroundGenerationStore } from './components/chat/backgroundGenerationStore'
import {
  startBackgroundJobCloseGuard,
  startWindowSizePersistence,
  currentWindowLabel,
} from './lib/windows'

export default function App() {
  const init = useAppStore((s) => s.init)

  useEffect(() => {
    let disposed = false
    const cleanups: Array<() => void> = []
    const registerCleanup = (promise: Promise<() => void>, label: string) => {
      void promise
        .then((cleanup) => {
          if (disposed) {
            cleanup()
            return
          }
          cleanups.push(cleanup)
        })
        .catch((err) => {
          console.error(`[APP] ${label} failed`, err)
        })
    }

    init()
    void useBackgroundGenerationStore
      .getState()
      .recoverInterruptedStreams()
      .catch((err) => {
        console.error('[APP] stream recovery failed', err)
      })
    if (currentWindowLabel() === 'main') {
      registerCleanup(startWindowSizePersistence(), 'window size persistence')
      registerCleanup(startBackgroundJobCloseGuard(), 'close guard')
    }

    return () => {
      disposed = true
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [])

  return <RouterProvider router={router} />
}
