import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, CheckIcon, XIcon } from '@phosphor-icons/react'
import { useProjectStore } from '@/components/projects/projectStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import type { Project } from '@/lib/db/types'

interface ProjectHeaderProps {
  project: Project
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const rename = useProjectStore((s) => s.rename)
  const operationState = useProjectStore((s) => s.operationStates[project.id])
  const isRenaming = operationState === 'renaming'

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(project.name)
    setEditing(true)
    // Focus in next tick after render
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function apply() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== project.name) {
      rename(project.id, trimmed)
    }
    setEditing(false)
  }

  function discard() {
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      apply()
    }
    if (e.key === 'Escape') discard()
  }

  return (
    <div className='flex items-center gap-3 px-page-x py-surface-card border-b'>
      <Link
        to='/'
        className='text-muted-foreground hover:text-foreground flex h-control-sm items-center gap-1.5 rounded-control px-2 type-ui-sm transition-colors shrink-0'
      >
        <ArrowLeftIcon className='size-icon-sm' />
        Projects
      </Link>

      <span className='text-muted-foreground type-ui-sm'>/</span>

      {editing ? (
        <div className='flex items-center gap-2 min-w-0'>
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className='h-control-sm min-w-0 w-56 border-0 border-b border-primary bg-transparent px-0 type-title-sm font-medium shadow-none rounded-none focus-visible:ring-0'
            autoFocus
          />
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={apply}
            disabled={isRenaming}
            aria-label='Apply rename'
          >
            {isRenaming ? (
              <Spinner className='size-3' />
            ) : (
              <CheckIcon className='size-icon-sm' />
            )}
          </Button>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={discard}
            aria-label='Discard rename'
          >
            <XIcon className='size-icon-sm' />
          </Button>
        </div>
      ) : (
        <Button
          variant='ghost'
          size='sm'
          onClick={startEdit}
          className='min-w-0 max-w-full justify-start px-2 type-title-sm font-medium'
          title='Click to rename'
        >
          {project.name}
        </Button>
      )}
    </div>
  )
}
