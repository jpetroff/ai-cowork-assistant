import { useState, useEffect } from 'react'
import { useArtifactStore } from '@/stores/artifactStore'
import { parseRevisionMetadata } from '@/lib/revision-utils'
import { getArtifact } from '@/lib/db/repositories/documents'
import type { Message } from '@/lib/db/types'
import { FileText } from 'lucide-react'

interface ArtifactRevisionCardProps {
  message: Message
  isActive: boolean
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ArtifactRevisionCard({ message, isActive }: ArtifactRevisionCardProps) {
  const meta = parseRevisionMetadata(message)
  const requestRevisionLoad = useArtifactStore((s) => s.requestRevisionLoad)
  const [artifactTitle, setArtifactTitle] = useState<string | null>(null)

  useEffect(() => {
    if (!meta?.artifactId) return
    getArtifact(meta.artifactId).then((a) => setArtifactTitle(a?.title ?? null))
  }, [meta?.artifactId])

  if (!meta) return null

  const authorLabel = meta.author === 'ai' ? 'AI' : 'You'

  return (
    <div className="flex justify-center" data-revision-id={meta.revisionId}>
      <div
        data-active={isActive || undefined}
        className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm max-w-[80%] w-full cursor-pointer transition-colors hover:bg-muted/60 data-active:border-primary data-active:bg-primary/10"
        onClick={() => requestRevisionLoad(meta.revisionId)}
      >
        <FileText className="size-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{artifactTitle ?? 'Untitled'}</p>
          <p className="text-[10px] text-muted-foreground">
            from {formatTime(message.created_at)} {formatDate(message.created_at)} · {authorLabel}
          </p>
        </div>
      </div>
    </div>
  )
}
