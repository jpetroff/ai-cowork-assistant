import { useLayoutEffect, useRef } from 'react'
import type { Editor as TiptapEditor } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { useArtifactStore, artifactFlushRef } from '@/stores/artifactStore'
import { useMessageStore } from '@/stores/messageStore'
import { EditorSkeleton } from './EditorSkeleton'
import { Editor } from './Editor'

const DEBOUNCE_MS = 1000

export function EditorPanel() {
  const artifact = useArtifactStore((s) => s.artifact)
  const headRevision = useArtifactStore((s) => s.headRevision)
  const contentSwapRequest = useArtifactStore((s) => s.contentSwapRequest)
  const loadedRevisionId = useArtifactStore((s) => s.loadedRevisionId)
  const acknowledgeSwap = useArtifactStore((s) => s.acknowledgeSwap)
  const save = useArtifactStore((s) => s.save)
  const isStreaming = useMessageStore((s) => s.isStreaming)

  // Tracks the revision ID currently loaded in TipTap — the sole authority for saves
  const revisionIdRef = useRef<string | null>(null)
  // Debounce timer — lives in component, not store
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // TipTap editor instance — set via onEditorReady, cleared via onEditorDestroy
  const editorRef = useRef<TiptapEditor | null>(null)

  // ── flushPendingSave — write into artifactFlushRef (non-reactive, no re-render) ──
  // Assigned directly in render body, not in an effect, because artifactFlushRef is not state.
  artifactFlushRef.current = async (): Promise<void> => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    const editor = editorRef.current
    const revisionId = revisionIdRef.current
    if (!editor || !revisionId) return
    // Re-read fresh content from editor — never use a stale closure value
    const content = (editor as TiptapEditor & { getMarkdown: () => string }).getMarkdown()
    await save({ revisionId, content })
  }

  // ── useLayoutEffect #1: content swap ─────────────────────────────────────────
  // Fires synchronously after DOM paint when contentSwapRequest changes.
  // Cancels pending debounce, replaces editor content, clears history, updates ref.
  useLayoutEffect(() => {
    if (!contentSwapRequest) return
    const editor = editorRef.current
    if (!editor) return

    // Cancel any pending debounced save — new content is authoritative
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    editor.commands.setContent(contentSwapRequest.content)
    // Mark a clean undo boundary — future edits won't undo past this swap
    editor.view.dispatch(closeHistory(editor.state.tr).setMeta('addToHistory', false))
    revisionIdRef.current = contentSwapRequest.revisionId

    acknowledgeSwap()
  }, [contentSwapRequest, acknowledgeSwap])

  // ── useLayoutEffect #2: revisionIdRef sync after draft creation ───────────────
  // When the store creates a copy-on-write draft and updates loadedRevisionId
  // without a contentSwapRequest, we must update revisionIdRef so future saves
  // target the new draft rather than the old sealed revision.
  useLayoutEffect(() => {
    // Only sync when there is no pending swap (swap handler already updates the ref)
    if (contentSwapRequest) return
    if (loadedRevisionId !== null) {
      revisionIdRef.current = loadedRevisionId
    }
  }, [loadedRevisionId, contentSwapRequest])

  // ── useLayoutEffect cleanup: clear debounce on unmount ────────────────────────
  useLayoutEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }
      // Clear the flush ref so ChatInput doesn't call a stale closure after unmount
      artifactFlushRef.current = null
    }
  }, [])

  // ── onChange handler — owns the debounce ────────────────────────────────────
  const handleChange = (content: string) => {
    const revisionId = revisionIdRef.current
    if (!revisionId) return

    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      save({ revisionId, content })
    }, DEBOUNCE_MS)
  }

  if (!artifact && !headRevision) return <EditorSkeleton />

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
        content={headRevision?.content ?? ''}
        onChange={handleChange}
        isStreaming={isStreaming}
        onEditorReady={(editor) => { editorRef.current = editor }}
        onEditorDestroy={() => { editorRef.current = null }}
      />
    </div>
  )
}
