import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, CheckIcon, XIcon } from '@phosphor-icons/react'
import { useProjectStore } from '@/components/projects/projectStore'
import { Button } from '@/components/ui/button'
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
    <div className='flex items-center gap-3 px-6 py-4 border-b'>
      <Link
        to='/'
        className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors shrink-0'
      >
        <ArrowLeftIcon className='size-3.5' />
        Projects
      </Link>

      <span className='text-muted-foreground text-xs'>/</span>

      {editing ? (
        <div className='flex items-center gap-1 min-w-0'>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className='bg-transparent border-b border-primary text-sm font-medium outline-none min-w-0 w-48'
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
              <CheckIcon className='size-3.5' />
            )}
          </Button>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={discard}
            aria-label='Discard rename'
          >
            <XIcon className='size-3.5' />
          </Button>
        </div>
      ) : (
        <button
          onClick={startEdit}
          className='text-sm font-medium hover:text-muted-foreground transition-colors truncate text-left'
          title='Click to rename'
        >
          {project.name}
        </button>
      )}
    </div>
  )
}
