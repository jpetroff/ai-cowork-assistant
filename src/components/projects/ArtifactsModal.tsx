import { useEffect, useState } from 'react'
import { FilesIcon } from '@phosphor-icons/react'
import { listArtifactsByProject } from '@/lib/db/repositories/documents'
import type { Artifact } from '@/lib/db/types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

interface ArtifactsModalProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(unixMs: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(unixMs))
}

export function ArtifactsModal({ projectId, open, onOpenChange }: ArtifactsModalProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])

  useEffect(() => {
    if (!open) return
    listArtifactsByProject(projectId).then(setArtifacts).catch(() => {})
  }, [open, projectId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>All Documents</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {artifacts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              No documents yet
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {artifacts.map((artifact) => (
                <div key={artifact.id} className="flex items-center gap-3 py-3">
                  <FilesIcon className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{artifact.title || 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(artifact.updated_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
