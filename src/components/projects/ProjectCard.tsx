import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DotsThreeIcon,
  PencilSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useProjectStore } from '@/components/projects/projectStore'
import type { Project } from '@/lib/db/types'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { RenameProjectForm } from './RenameProjectForm'
import { cn } from '@/lib/utils'

interface ProjectCardProps {
  project: Project
}

function formatDate(unixMs: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(unixMs)
  )
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()
  const operationState = useProjectStore((s) => s.operationStates[project.id])
  const deleteProject = useProjectStore((s) => s.delete)
  const setActive = useProjectStore((s) => s.setActive)

  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isDeleting = operationState === 'deleting'
  const isRenaming = operationState === 'renaming'
  const isBusy = isDeleting || isRenaming

  function handleClick() {
    if (isBusy) return
    setActive(project.id)
    navigate(`/projects/${project.id}`)
  }

  function handleDelete() {
    setDeleteOpen(false)
    deleteProject(project.id)
  }

  return (
    <>
      <Card
        role='button'
        tabIndex={isBusy ? -1 : 0}
        aria-busy={isBusy}
        aria-label={`Open project ${project.name}`}
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        className={cn(
          'cursor-pointer transition-opacity select-none',
          isBusy && 'opacity-50 cursor-not-allowed pointer-events-none'
        )}
      >
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            {project.name}
            {(isDeleting || isRenaming) && <Spinner className='size-3' />}
          </CardTitle>
          <CardDescription>{formatDate(project.updated_at)}</CardDescription>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={isBusy}
                onClick={(e) => e.stopPropagation()}
                render={
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label='Project options'
                    onClick={(e) => e.stopPropagation()}
                  />
                }
              >
                <DotsThreeIcon weight='bold' />
              </DropdownMenuTrigger>
              <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    setRenameOpen(true)
                  }}
                >
                  <PencilSimpleIcon />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className='text-destructive focus:text-destructive'
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteOpen(true)
                  }}
                >
                  <TrashIcon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
      </Card>

      <RenameProjectForm
        project={project}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              "{project.name}" will be removed from the app. Files on disk are
              not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
