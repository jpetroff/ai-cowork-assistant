import { useEffect, useRef } from 'react'
import { useArtifactStore, artifactFlushRef } from '@/stores/artifactStore'
import { useMessageStore } from '@/stores/messageStore'
import { EditorSkeleton } from './EditorSkeleton'
import { Editor } from './Editor'

export function EditorPanel() {
  const status = useArtifactStore((s) => s.status)
  const artifact = useArtifactStore((s) => s.artifact)
  const editorKey = useArtifactStore((s) => s.editorKey)
  const loadedContent = useArtifactStore((s) => s.loadedContent)
  const save = useArtifactStore((s) => s.save)
  const isStreaming = useMessageStore((s) => s.isStreaming)

  // Editor writes its async flush fn here; artifactFlushRef forwards it to ChatInput
  const editorFlushRef = useRef<(() => Promise<void>) | null>(null)

  // Wire editorFlushRef → artifactFlushRef (non-reactive, no re-render)
  artifactFlushRef.current = async () => { await editorFlushRef.current?.() }

  useEffect(() => {
    return () => { artifactFlushRef.current = null }
  }, [])

  // Editor is only mounted when status is 'ready' — loading/idle show skeleton
  if (status !== 'ready') return <EditorSkeleton />

  if (!artifact) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No artifact selected.
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <Editor
        key={editorKey}
        content={loadedContent}
        onSave={(content) => save(content)}
        flushRef={editorFlushRef}
        isStreaming={isStreaming}
      />
    </div>
  )
}
