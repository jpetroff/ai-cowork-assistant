import { useArtifactStore } from '@/stores/artifactStore'
import type { ArtifactRevision } from '@/lib/db/types'
import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'

interface RevisionCardProps {
  revision: ArtifactRevision
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RevisionCard({ revision }: RevisionCardProps) {
  const requestRevisionLoad = useArtifactStore((s) => s.requestRevisionLoad)
  const loadedRevisionId = useArtifactStore((s) => s.loadedRevisionId)

  const isLoaded = revision.id === loadedRevisionId
  const label = revision.author === 'ai' ? 'AI updated the document' : 'You sent this document version'

  return (
    <div className="flex justify-center">
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm max-w-[80%] w-full">
        <FileText className="size-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground">{formatTimestamp(revision.created_at)}</p>
        </div>
        <Button
          variant={isLoaded ? 'secondary' : 'outline'}
          size="sm"
          className="h-6 text-xs px-2 shrink-0"
          onClick={() => requestRevisionLoad(revision.id)}
          disabled={isLoaded}
        >
          {isLoaded ? 'Loaded' : 'Load'}
        </Button>
      </div>
    </div>
  )
}
