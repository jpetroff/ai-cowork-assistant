import { useEffect, useMemo, useRef } from 'react'
import { useMessageStore } from '@/components/chat/messageStore'
import { buildThread } from '@/lib/revision-utils'
import { MessageListSkeleton } from './MessageListSkeleton'
import { MessageBubble } from './MessageBubble'
import { GenerationStepTrigger } from './GenerationSteps'
import type { GenerationMetadata } from './generationMetadata'

function MessageListEmpty() {
  return (
    <div className='flex-1 flex items-center justify-center text-muted-foreground type-ui-md'>
      Start a conversation below.
    </div>
  )
}

function StreamingBubble({
  content,
  generation,
}: {
  content: string
  generation: GenerationMetadata | null
}) {
  const visibleGeneration = generation ?? { startedAt: Date.now(), steps: [] }

  return (
    <div className='flex justify-start'>
      <div className='max-w-[80%] rounded-card px-surface-card py-control-y-md type-ui-md bg-muted text-foreground'>
        {content && (
          <p className='whitespace-pre-wrap wrap-break-word m-0'>{content}</p>
        )}
        <GenerationStepTrigger generation={visibleGeneration} isStreaming />
      </div>
    </div>
  )
}

export function MessageList() {
  const status = useMessageStore((s) => s.status)
  const messages = useMessageStore((s) => s.messages)
  const isStreaming = useMessageStore((s) => s.isStreaming)
  const streamingContent = useMessageStore((s) => s.streamingContent)
  const streamingGeneration = useMessageStore((s) => s.streamingGeneration)
  const bottomRef = useRef<HTMLDivElement>(null)

  const thread = useMemo(() => buildThread(messages), [messages])

  // Auto-scroll to bottom when messages change or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length, streamingContent, streamingGeneration?.steps.length])

  if (status === 'loading') return <MessageListSkeleton />

  return (
    <div className='flex-1 overflow-y-auto px-surface-card py-surface-card-lg flex flex-col gap-surface-card min-h-0'>
      {thread.length === 0 && status === 'ready' && <MessageListEmpty />}

      {thread.map((item) => (
        <MessageBubble key={item.data.id} message={item.data} />
      ))}

      {/* STUB: tool-call-indicator — render AI tool call steps here (FR-AI-007) */}

      {/* STUB: hitl-approval — render approval card for AI-proposed actions here (FR-AI-004, BR-AI-005) */}

      {isStreaming && (
        <StreamingBubble
          content={streamingContent}
          generation={streamingGeneration}
        />
      )}

      <div ref={bottomRef} />
    </div>
  )
}
