import { useEffect, useRef, useState } from 'react'
import { useArtifactStore } from '@/stores/artifactStore'
import { cn } from '@/lib/utils'

function SaveStatus({ isDirty, isSaving, lastSavedAt }: { isDirty: boolean; isSaving: boolean; lastSavedAt: number | null }) {
  const [showSaved, setShowSaved] = useState(false)
  const prevLastSavedAt = useRef(lastSavedAt)

  useEffect(() => {
    if (lastSavedAt !== null && lastSavedAt !== prevLastSavedAt.current) {
      prevLastSavedAt.current = lastSavedAt
      setShowSaved(true)
      const timer = setTimeout(() => setShowSaved(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [lastSavedAt])

  if (isDirty || isSaving) {
    return <span className="text-xs text-muted-foreground">Saving…</span>
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
  const activeArtifact = useArtifactStore((s) => s.activeArtifact)
  const isDirty = useArtifactStore((s) => s.isDirty)
  const isSaving = useArtifactStore((s) => s.isSaving)
  const lastSavedAt = useArtifactStore((s) => s.lastSavedAt)
  const rename = useArtifactStore((s) => s.rename)

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const handleTitleClick = () => {
    setEditValue(activeArtifact?.title ?? '')
    setIsEditing(true)
  }

  const handleTitleSubmit = async () => {
    const title = editValue.trim() || null
    await rename(title)
    setIsEditing(false)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleTitleSubmit() }
              if (e.key === 'Escape') setIsEditing(false)
            }}
            placeholder="Untitled"
            className="w-full text-xl font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
          />
        ) : (
          <button
            onClick={handleTitleClick}
            className="text-xl font-semibold text-left w-full truncate hover:opacity-70 transition-opacity"
          >
            {activeArtifact?.title ?? <span className="text-muted-foreground/50">Untitled</span>}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* STUB: artifact-version — show version badge/selector here (e.g. "v3 of 5") */}
        {/* STUB: link-to-file — file sync button here (FR-EDT-010) */}
        <SaveStatus isDirty={isDirty} isSaving={isSaving} lastSavedAt={lastSavedAt} />
      </div>
    </div>
  )
}
