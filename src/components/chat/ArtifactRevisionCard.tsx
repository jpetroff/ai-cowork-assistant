import { useArtifactStore } from '@/components/editor/artifactStore'
import { parseRevisionMetadata } from '@/lib/revision-utils'
import { Button } from '@/components/ui/button'
import type { Message } from '@/lib/db/types'
import { FileText } from 'lucide-react'

interface ArtifactRevisionCardProps {
  message: Message
  isActive: boolean
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function ArtifactRevisionCard({
  message,
  isActive,
}: ArtifactRevisionCardProps) {
  const meta = parseRevisionMetadata(message)
  const requestRevisionLoad = useArtifactStore((s) => s.requestRevisionLoad)
  const loadedArtifactTitle = useArtifactStore((s) =>
    meta?.artifactId && s.artifact?.id === meta.artifactId
      ? s.artifact.title
      : null
  )

  if (!meta) return null

  const authorLabel = meta.author === 'ai' ? 'AI' : 'You'
  const artifactTitle = loadedArtifactTitle ?? 'Untitled'

  return (
    <div className='flex justify-center' data-revision-id={meta.revisionId}>
      <Button
        type='button'
        variant='ghost'
        aria-label={
          isActive ? 'Loaded artifact revision' : 'Load artifact revision'
        }
        disabled={isActive}
        data-active={isActive || undefined}
        className='h-auto max-w-[80%] w-full justify-start gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm hover:bg-muted/60 data-active:border-primary data-active:bg-primary/10'
        onClick={() => requestRevisionLoad(meta.revisionId)}
      >
        <FileText className='size-4 text-muted-foreground shrink-0' />
        <div className='flex-1 min-w-0'>
          <p className='text-xs font-medium truncate'>{artifactTitle}</p>
          <p className='text-[10px] text-muted-foreground'>
            from {formatTime(message.created_at)}{' '}
            {formatDate(message.created_at)} · {authorLabel}
          </p>
        </div>
      </Button>
    </div>
  )
}
