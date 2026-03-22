import { useEffect, useRef } from 'react'
import { useMessageStore } from '@/stores/messageStore'
import { MessageListSkeleton } from './MessageListSkeleton'
import { MessageBubble } from './MessageBubble'

function MessageListEmpty() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Start a conversation below.
    </div>
  )
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted text-foreground">
        {content ? (
          <p className="whitespace-pre-wrap wrap-break-word m-0">{content}</p>
        ) : (
          <span className="flex gap-1 items-center h-5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
          </span>
        )}
      </div>
    </div>
  )
}

export function MessageList() {
  const status = useMessageStore((s) => s.status)
  const messages = useMessageStore((s) => s.messages)
  const isStreaming = useMessageStore((s) => s.isStreaming)
  const streamingContent = useMessageStore((s) => s.streamingContent)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, streamingContent])

  if (status === 'loading') return <MessageListSkeleton />

  return (
    <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3 min-h-0">
      {messages.length === 0 && status === 'ready' && <MessageListEmpty />}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* STUB: tool-call-indicator — render AI tool call steps here (FR-AI-007) */}

      {/* STUB: hitl-approval — render approval card for AI-proposed actions here (FR-AI-004, BR-AI-005) */}

      {isStreaming && <StreamingBubble content={streamingContent} />}

      <div ref={bottomRef} />
    </div>
  )
}
