import type { Message } from '@/lib/db/types'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground prose prose-sm dark:prose-invert'
        )}
      >
        <p className="whitespace-pre-wrap wrap-break-word m-0">{message.content}</p>
      </div>
    </div>
  )
}
