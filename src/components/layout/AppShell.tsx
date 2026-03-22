import { useEffect, useState } from 'react'
import { useNavigate, useNavigation } from 'react-router-dom'
import { currentWindowLabel } from '@/lib/windows'
import { useAppStore } from '@/stores/appStore'
import { LoadingPage } from '@/pages/LoadingPage'
import { NotificationToast } from '@/components/ui/NotificationToast'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [windowLabel, setWindowLabel] = useState<string | null>(null)
  const appPhase = useAppStore((s) => s.appPhase)
  const navigate = useNavigate()
  const navigation = useNavigation()
  const isRouting = navigation.state === 'loading'

  useEffect(() => {
    setWindowLabel(currentWindowLabel())
  }, [])

  // Navigate main window to the correct route when appPhase changes
  useEffect(() => {
    if (windowLabel !== 'main') return
    if (appPhase === 'setup') navigate('/setup', { replace: true })
    else if (appPhase === 'ready') navigate('/', { replace: true })
  }, [appPhase, windowLabel])

  // Splash window: always render LoadingPage, ignore router
  // pt-8 accounts for macOS overlay titlebar (traffic light buttons)
  if (windowLabel === 'splash') {
    return (
      <div className="h-full pt-8">
        <LoadingPage />
      </div>
    )
  }

  // Main window: show LoadingPage overlay while sidecar is starting
  if (appPhase === 'loading') {
    return <LoadingPage />
  }

  return (
    <div className="flex flex-col h-screen">
      {isRouting && (
        <div className="h-0.5 bg-primary animate-pulse fixed top-0 left-0 right-0 z-50" />
      )}
      {children}
      <NotificationToast />
    </div>
  )
}
