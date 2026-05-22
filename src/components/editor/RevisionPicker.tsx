import { useArtifactStore } from '@/components/editor/artifactStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function RevisionPicker() {
  const revisions = useArtifactStore((s) => s.revisions)
  const artifact = useArtifactStore((s) => s.artifact)
  const loadedRevisionId = useArtifactStore((s) => s.loadedRevisionId)
  const requestRevisionLoad = useArtifactStore((s) => s.requestRevisionLoad)

  // Hide when there is only one revision or fewer
  if (revisions.length <= 1) return null

  const currentIndex = revisions.findIndex((r) => r.id === loadedRevisionId)
  const displayN = currentIndex >= 0 ? currentIndex + 1 : revisions.length
  const total = revisions.length

  // Drafts (message_id === null) are shown in the picker but labelled accordingly
  const revisionItems = [...revisions].reverse() // show newest first

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className='h-control-xs gap-1 type-ui-xs text-muted-foreground px-control-x-sm flex items-center rounded-control hover:bg-accent transition-colors'>
        v{displayN} of {total}
        <ChevronDown className='size-icon-sm ml-1' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-64'>
        {revisionItems.map((revision, idx) => {
          const versionN = revisions.length - idx
          const isLoaded = revision.id === loadedRevisionId
          const isCurrent = revision.id === artifact?.current_revision_id
          const isDraft = revision.message_id === null
          const authorLabel = revision.author === 'ai' ? 'AI' : 'You'

          return (
            <DropdownMenuItem
              key={revision.id}
              onClick={() => void requestRevisionLoad(revision.id)}
              className={cn(
                'flex flex-col items-start gap-0.5 cursor-pointer',
                isLoaded && 'bg-accent'
              )}
            >
              <span className='flex items-center gap-1.5 w-full'>
                <span className='font-medium type-ui-xs'>v{versionN}</span>
                <span className='type-ui-xs text-muted-foreground'>
                  · {authorLabel}
                </span>
                {isDraft && (
                  <span className='ml-auto type-ui-xs text-muted-foreground border rounded-control px-1'>
                    draft
                  </span>
                )}
                {isCurrent && !isDraft && (
                  <span className='ml-auto type-ui-xs text-primary border border-primary/30 rounded-control px-1'>
                    current
                  </span>
                )}
              </span>
              <span className='type-ui-xs text-muted-foreground'>
                {formatTimestamp(revision.created_at)}
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
