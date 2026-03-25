import { useArtifactStore } from '@/stores/artifactStore'
import { parseRevisionMetadata } from '@/lib/revision-utils'
import type { Message } from '@/lib/db/types'
import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'

interface ArtifactRevisionCardProps {
  message: Message
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ArtifactRevisionCard({ message }: ArtifactRevisionCardProps) {
  const requestRevisionLoad = useArtifactStore((s) => s.requestRevisionLoad)
  const loadedRevisionId = useArtifactStore((s) => s.loadedRevisionId)
  const artifactTitle = useArtifactStore((s) => s.artifact?.title ?? 'Untitled')

  const meta = parseRevisionMetadata(message)
  if (!meta) return null

  const isLoaded = meta.revisionId === loadedRevisionId
  const authorLabel = meta.author === 'ai' ? 'AI' : 'You'

  return (
    <div className="flex justify-center">
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm max-w-[80%] w-full">
        <FileText className="size-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{artifactTitle}</p>
          <p className="text-[10px] text-muted-foreground">
            {authorLabel} · {formatTimestamp(message.created_at)}
          </p>
        </div>
        <Button
          variant={isLoaded ? 'secondary' : 'outline'}
          size="sm"
          className="h-6 text-xs px-2 shrink-0"
          onClick={() => requestRevisionLoad(meta.revisionId)}
          disabled={isLoaded}
        >
          {isLoaded ? 'Loaded' : 'Load'}
        </Button>
      </div>
    </div>
  )
}
