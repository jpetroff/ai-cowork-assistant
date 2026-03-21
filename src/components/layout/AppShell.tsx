import { useNavigation } from 'react-router-dom'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const navigation = useNavigation()
  const isLoading = navigation.state === 'loading'

  return (
    <div className="flex flex-col h-screen">
      {isLoading && (
        <div className="h-0.5 bg-primary animate-pulse fixed top-0 left-0 right-0 z-50" />
      )}
      {children}
    </div>
  )
}
