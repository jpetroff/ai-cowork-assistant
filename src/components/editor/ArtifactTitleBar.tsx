import { useEffect, useRef, useState } from 'react'
import { FilePlus } from 'lucide-react'
import { useChatSessionStore } from '@/components/chat/chatSessionStore'
import { useArtifactStore } from '@/components/editor/artifactStore'
import { Button } from '@/components/ui/button'
import { RevisionPicker } from './RevisionPicker'
import { ArtifactMenu } from './ArtifactMenu'
import { cn } from '@/lib/utils'

function SaveStatus({
  isSaving,
  saveError,
}: {
  isSaving: boolean
  saveError: string | null
}) {
  const [showSaved, setShowSaved] = useState(false)
  const prevIsSaving = useRef(isSaving)

  useEffect(() => {
    // Transition from saving → not saving (and no error) = just saved
    if (prevIsSaving.current && !isSaving && !saveError) {
      prevIsSaving.current = false
      setShowSaved(true)
      const timer = setTimeout(() => setShowSaved(false), 2000)
      return () => clearTimeout(timer)
    }
    prevIsSaving.current = isSaving
  }, [isSaving, saveError])

  if (saveError) {
    return (
      <span
        className='text-xs text-destructive truncate max-w-32'
        title={saveError}
      >
        Save error
      </span>
    )
  }

  if (isSaving) {
    return <span className='text-xs text-muted-foreground'>Saving…</span>
  }

  return (
    <span
      className={cn(
        'text-xs text-muted-foreground transition-opacity duration-500',
        showSaved ? 'opacity-100' : 'opacity-0'
      )}
    >
      Saved
    </span>
  )
}

export function ArtifactTitleBar() {
  const artifact = useArtifactStore((s) => s.artifact)
  const isSaving = useArtifactStore((s) => s.isSaving)
  const saveError = useArtifactStore((s) => s.saveError)
  const rename = useArtifactStore((s) => s.rename)
  const createNewDocument = useChatSessionStore((s) => s.createNewDocument)

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const handleTitleClick = () => {
    setEditValue(artifact?.title ?? '')
    setIsEditing(true)
  }

  const handleTitleSubmit = async () => {
    const title = editValue.trim() || null
    await rename(title)
    setIsEditing(false)
  }

  return (
    <div className='flex items-center gap-3 px-4 py-2 border-b shrink-0'>
      <div className='flex-1 min-w-0'>
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleTitleSubmit()
              }
              if (e.key === 'Escape') setIsEditing(false)
            }}
            placeholder='Untitled'
            className='w-full text-xl font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/50'
          />
        ) : (
          <button
            onClick={handleTitleClick}
            className='text-xl font-semibold text-left w-full truncate hover:opacity-70 transition-opacity'
          >
            {artifact?.title ?? (
              <span className='text-muted-foreground/50'>Untitled</span>
            )}
          </button>
        )}
      </div>

      <div className='flex items-center gap-2 shrink-0'>
        <ArtifactMenu />
        <RevisionPicker />
        {/* STUB: link-to-file — file sync button here (FR-EDT-010) */}
        <SaveStatus isSaving={isSaving} saveError={saveError} />
        <Button
          variant='ghost'
          size='icon-sm'
          onClick={() =>
            artifact && createNewDocument(artifact.conversation_id)
          }
          aria-label='New artifact'
          title='New artifact'
        >
          <FilePlus className='size-4' />
        </Button>
      </div>
    </div>
  )
}
