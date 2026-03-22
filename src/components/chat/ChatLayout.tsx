import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSetting, setSetting } from '@/lib/db/settings'
import { ChatColumn } from './ChatColumn'
import { EditorSection } from '../editor/EditorSection'

const CHAT_COLUMN_WIDTH_KEY = 'chat_column_width'
const DEFAULT_WIDTH = 320
const MIN_WIDTH = 240
const MAX_WIDTH = 560

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function DragHandle({ onDrag }: { onDrag: (delta: number) => void }) {
  const startXRef = useRef<number | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startXRef.current = e.clientX

      const handleMouseMove = (ev: MouseEvent) => {
        if (startXRef.current === null) return
        const delta = ev.clientX - startXRef.current
        startXRef.current = ev.clientX
        onDrag(delta)
      }

      const handleMouseUp = () => {
        startXRef.current = null
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [onDrag]
  )

  return (
    <div
      className="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
      onMouseDown={handleMouseDown}
      aria-hidden
    />
  )
}

export function ChatLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const [columnWidth, setColumnWidth] = useState(DEFAULT_WIDTH)
  const finalWidthRef = useRef(columnWidth)

  // Load persisted column width on mount
  useEffect(() => {
    getSetting(CHAT_COLUMN_WIDTH_KEY)
      .then((val) => {
        if (val !== null) {
          const parsed = parseInt(val, 10)
          if (!isNaN(parsed)) {
            const clamped = clamp(parsed, MIN_WIDTH, MAX_WIDTH)
            setColumnWidth(clamped)
            finalWidthRef.current = clamped
          }
        }
      })
      .catch(() => {/* ignore — use default */})
  }, [])

  const handleDrag = useCallback((delta: number) => {
    setColumnWidth((prev) => {
      const next = clamp(prev + delta, MIN_WIDTH, MAX_WIDTH)
      finalWidthRef.current = next
      return next
    })
  }, [])

  // Persist width on drag end (mouseup is handled inside DragHandle, so we
  // watch finalWidthRef via a separate mouseup listener on document)
  useEffect(() => {
    const handleMouseUp = () => {
      setSetting(CHAT_COLUMN_WIDTH_KEY, String(finalWidthRef.current)).catch(() => {})
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <div style={{ width: columnWidth }} className="shrink-0 flex flex-col h-full overflow-hidden">
        <ChatColumn projectId={projectId ?? ''} />
      </div>
      <DragHandle onDrag={handleDrag} />
      {/* EditorSection: flex-1, min-w-0 prevents layout blowout on resize */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <EditorSection />
      </div>
    </div>
  )
}
