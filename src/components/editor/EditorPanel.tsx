import { useEffect } from 'react'
import { useArtifactStore } from '@/stores/stubs'
import { EditorSkeleton } from './EditorSkeleton'

export function EditorPanel() {
  const status = useArtifactStore(s => s.status)

  useEffect(() => {
    // TODO: initialize editor when status === 'ready'
  }, [status])

  if (status === 'loading') return <EditorSkeleton />

  return (
    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
      No artifact selected.
    </div>
  )
}
