import { useEffect, useRef } from 'react'
import { useArtifactStore } from '@/stores/artifactStore'
import { useMessageStore } from '@/stores/messageStore'
import { console_if } from '@/lib/logger'
import { EditorSkeleton } from './EditorSkeleton'
import { Editor } from './Editor'

export function EditorPanel() {
  // const status = useArtifactStore((s) => s.status)
  const artifact = useArtifactStore((s) => s.artifact)
  const editorKey = useArtifactStore((s) => s.editorKey)
  const loadedContent = useArtifactStore((s) => s.loadedContent)
  const save = useArtifactStore((s) => s.save)
  const isStreaming = useMessageStore((s) => s.isStreaming)

  console_if('EDITOR').log(
    '[EDITOR]',
    'EditorPanel: what changed',
    artifact,
    editorKey,
    loadedContent,
    save,
    isStreaming
  )

  // Editor is only mounted when status is 'ready' — loading/idle show skeleton
  if (editorKey == null) return <EditorSkeleton />

  if (!artifact) {
    return (
      <div className='flex-1 flex items-center justify-center text-muted-foreground text-sm'>
        No artifact selected.
      </div>
    )
  }

  return (
    <div className='flex-1 min-h-0 flex flex-col overflow-hidden'>
      <Editor
        key={editorKey}
        content={loadedContent}
        onSave={save}
        isStreaming={isStreaming}
      />
    </div>
  )
}
