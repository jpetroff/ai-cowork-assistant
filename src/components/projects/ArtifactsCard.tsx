import { useEffect, useState } from 'react'
import { FilesIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { listArtifactsByProject } from '@/lib/db/repositories/artifacts'
import type { Artifact } from '@/lib/db/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArtifactsModal } from './ArtifactsModal'

interface ArtifactsCardProps {
  projectId: string
}

export function ArtifactsCard({ projectId }: ArtifactsCardProps) {
  const [preview, setPreview] = useState<Artifact[]>([])
  const [total, setTotal] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    listArtifactsByProject(projectId, 3).then(setPreview).catch(() => {})
    listArtifactsByProject(projectId).then((all) => setTotal(all.length)).catch(() => {})
  }, [projectId])

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FilesIcon className="size-3.5 text-muted-foreground" />
              Documents
            </div>
            {total > 0 && (
              <span className="text-xs font-normal text-muted-foreground">{total}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {preview.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">
              No documents created yet
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {preview.map((artifact) => (
                <p key={artifact.id} className="text-xs truncate text-foreground/80">
                  {artifact.title || 'Untitled'}
                </p>
              ))}
              {total > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 py-0.5 text-xs text-muted-foreground hover:text-foreground justify-start"
                  onClick={() => setModalOpen(true)}
                >
                  Show all {total}
                  <ArrowRightIcon className="size-3 ml-1" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ArtifactsModal
        projectId={projectId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  )
}
