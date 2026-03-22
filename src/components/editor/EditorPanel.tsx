import { useArtifactStore } from '@/stores/artifactStore'
import { useMessageStore } from '@/stores/messageStore'
import { EditorSkeleton } from './EditorSkeleton'
import { ProjectEditor } from '@/components/ProjectEditor'

export function EditorPanel() {
  const status = useArtifactStore((s) => s.status)
  const activeArtifact = useArtifactStore((s) => s.activeArtifact)
  const headRevision = useArtifactStore((s) => s.headRevision)
  const updateContent = useArtifactStore((s) => s.updateContent)
  const isStreaming = useMessageStore((s) => s.isStreaming)

  if (status === 'loading') return <EditorSkeleton />

  if (!activeArtifact) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No artifact selected.
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <ProjectEditor
        value={headRevision?.content ?? ''}
        onChange={updateContent}
        isStreaming={isStreaming}
        className="flex-1 min-h-0"
      />
    </div>
  )
}
