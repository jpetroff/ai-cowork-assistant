import { useState } from 'react'
import { FolderOpenIcon, FolderIcon } from '@phosphor-icons/react'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { useProjectStore } from '@/components/projects/projectStore'
import type { Project } from '@/lib/db/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface FolderCardProps {
  project: Project
}

export function FolderCard({ project }: FolderCardProps) {
  const updateProject = useProjectStore((s) => s.update)
  const [picking, setPicking] = useState(false)

  async function handlePickFolder() {
    if (picking) return
    setPicking(true)
    try {
      const selected = await openDialog({ directory: true, multiple: false })
      if (typeof selected === 'string') {
        await updateProject(project.id, { folder_path: selected })
      }
    } finally {
      setPicking(false)
    }
  }

  return (
    <Card size='sm'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <FolderIcon className='size-icon-sm text-muted-foreground' />
          Project Folder
        </CardTitle>
      </CardHeader>
      <CardContent>
        {project.folder_path ? (
          <div className='flex flex-col gap-2'>
            <p className='type-ui-xs text-muted-foreground truncate font-mono'>
              {project.folder_path}
            </p>
            <Button
              variant='outline'
              size='sm'
              onClick={handlePickFolder}
              disabled={picking}
              className='w-full'
            >
              <FolderOpenIcon className='size-icon-sm' />
              Change folder
            </Button>
          </div>
        ) : (
          <Button
            variant='outline'
            size='sm'
            onClick={handlePickFolder}
            disabled={picking}
            className='w-full'
          >
            <FolderOpenIcon className='size-icon-sm' />
            Attach folder
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
