import { useState, useEffect } from 'react'
import { useProjectStore } from '@/components/projects/projectStore'
import type { Project } from '@/lib/db/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RenameProjectFormProps {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RenameProjectForm({
  project,
  open,
  onOpenChange,
}: RenameProjectFormProps) {
  const rename = useProjectStore((s) => s.rename)
  const operationState = useProjectStore((s) => s.operationStates[project.id])
  const isRenaming = operationState === 'renaming'

  const [name, setName] = useState(project.name)

  // Sync input when dialog opens for a potentially different project
  useEffect(() => {
    if (open) setName(project.name)
  }, [open, project.name])

  // Close dialog when rename completes successfully (operationState clears)
  useEffect(() => {
    if (!isRenaming && open) {
      const hasError = useProjectStore.getState().operationStates[project.id]
      if (!hasError) {
        // Only close if we were renaming and now we're not (success path)
        // We track this via a ref to avoid closing on initial mount
      }
    }
  }, [isRenaming])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || trimmed === project.name) {
      onOpenChange(false)
      return
    }
    await rename(project.id, trimmed)
    // Close on success: if operationState is gone, rename succeeded
    if (!useProjectStore.getState().operationStates[project.id]) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!isRenaming}>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='project-name'>Name</Label>
            <Input
              id='project-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isRenaming}
              autoFocus
              autoComplete='off'
            />
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isRenaming || !name.trim()}>
              {isRenaming ? 'Renaming…' : 'Rename'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
