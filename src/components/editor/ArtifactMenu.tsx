import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, FileText } from 'lucide-react'
import { useArtifactStore } from '@/components/editor/artifactStore'
import { listArtifacts } from '@/lib/db/repositories/documents'
import { listRevisions } from '@/lib/db/repositories/revisions'
import type { Artifact, ArtifactRevision } from '@/lib/db/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface ArtifactMenuItem {
  artifact: Artifact
  latestRevision: ArtifactRevision | null
  revisionCount: number
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function buildArtifactMenuItems(
  conversationId: string
): Promise<ArtifactMenuItem[]> {
  const artifacts = await listArtifacts(conversationId)
  const items = await Promise.all(
    artifacts.map(async (artifact) => {
      const revisions = await listRevisions(artifact.id)
      const latestRevision = artifact.current_revision_id
        ? (revisions.find(
            (revision) => revision.id === artifact.current_revision_id
          ) ??
          revisions[0] ??
          null)
        : (revisions[0] ?? null)

      return {
        artifact,
        latestRevision,
        revisionCount: revisions.length,
      }
    })
  )

  return items.sort((a, b) => b.artifact.updated_at - a.artifact.updated_at)
}

export function ArtifactMenu() {
  const artifact = useArtifactStore((s) => s.artifact)
  const headRevision = useArtifactStore((s) => s.headRevision)
  const requestArtifactLoad = useArtifactStore((s) => s.requestArtifactLoad)
  const conversationId = artifact?.conversation_id ?? null

  const [items, setItems] = useState<ArtifactMenuItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    if (!conversationId) {
      setItems([])
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      setItems(await buildArtifactMenuItems(conversationId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifacts')
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    void loadItems()
  }, [loadItems, artifact?.id, headRevision?.id])

  const handleArtifactSelect = (artifactId: string) => {
    void requestArtifactLoad(artifactId).then(loadItems)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className='h-control-xs gap-1 type-ui-xs text-muted-foreground px-control-x-sm flex items-center rounded-control hover:bg-accent transition-colors disabled:pointer-events-none disabled:opacity-50'
        disabled={!conversationId}
        aria-label='Artifacts'
        title='Artifacts'
      >
        <FileText className='size-icon-sm' />
        <span className='hidden sm:inline'>Artifacts</span>
        <ChevronDown className='size-icon-sm' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-72'>
        <DropdownMenuLabel>Artifacts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading && (
          <DropdownMenuItem disabled className='text-muted-foreground'>
            Loading artifacts
          </DropdownMenuItem>
        )}
        {error && (
          <DropdownMenuItem disabled className='text-destructive'>
            {error}
          </DropdownMenuItem>
        )}
        {!isLoading && !error && items.length === 0 && (
          <DropdownMenuItem disabled className='text-muted-foreground'>
            No artifacts
          </DropdownMenuItem>
        )}
        {!isLoading &&
          !error &&
          items.map((item) => {
            const isActive = item.artifact.id === artifact?.id
            const title = item.artifact.title ?? 'Untitled'
            const revisionLabel =
              item.revisionCount === 1
                ? '1 revision'
                : `${item.revisionCount} revisions`

            return (
              <DropdownMenuItem
                key={item.artifact.id}
                onClick={() => handleArtifactSelect(item.artifact.id)}
                className={cn(
                  'flex cursor-pointer items-start gap-2 py-2',
                  isActive && 'bg-accent'
                )}
              >
                <FileText className='mt-0.5 size-icon-sm text-muted-foreground' />
                <span className='min-w-0 flex-1'>
                  <span className='block truncate font-medium'>{title}</span>
                  <span className='block truncate type-ui-xs text-muted-foreground'>
                    {revisionLabel}
                    {item.latestRevision
                      ? ` · Last edited ${formatTimestamp(item.latestRevision.updated_at)}`
                      : ' · No revisions yet'}
                  </span>
                </span>
                {isActive && <Check className='mt-0.5 size-icon-sm' />}
              </DropdownMenuItem>
            )
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
