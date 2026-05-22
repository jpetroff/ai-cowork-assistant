import { useEffect, useState } from 'react'
import { FilesIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { listArtifactsByProject } from '@/lib/db/repositories/documents'
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
    listArtifactsByProject(projectId, 3)
      .then(setPreview)
      .catch(() => {})
    listArtifactsByProject(projectId)
      .then((all) => setTotal(all.length))
      .catch(() => {})
  }, [projectId])

  return (
    <>
      <Card size='sm'>
        <CardHeader>
          <CardTitle className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <FilesIcon className='size-icon-sm text-muted-foreground' />
              Documents
            </div>
            {total > 0 && (
              <span className='type-ui-xs font-normal text-muted-foreground'>
                {total}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {preview.length === 0 ? (
            <p className='type-ui-sm text-muted-foreground py-1'>
              No documents created yet
            </p>
          ) : (
            <div className='flex flex-col gap-2'>
              {preview.map((artifact) => (
                <p
                  key={artifact.id}
                  className='type-ui-sm truncate text-foreground/80'
                >
                  {artifact.title || 'Untitled'}
                </p>
              ))}
              {total > 3 && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-auto px-0 py-0.5 type-ui-sm text-muted-foreground hover:text-foreground justify-start'
                  onClick={() => setModalOpen(true)}
                >
                  Show all {total}
                  <ArrowRightIcon className='size-icon-sm ml-1' />
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
