import type { ChatMessage as ChatMessageType } from '@/lib/chat/types'
import { AssistantMessage } from './AssistantMessage'
import { formatDistanceToNow } from 'date-fns'

export function ChatMessage({ message }: { message: ChatMessageType }) {
  return (
    <div className='rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground'>
      <p className='font-medium text-muted-foreground text-xs'>
        {message.role === 'user' ? 'You' : 'Assistant'}
      </p>
      {message.role === 'user' ? (
        <p className='mt-0.5 whitespace-pre-wrap'>{message.content}</p>
      ) : (
        <AssistantMessage message={message} />
      )}
      <p className='mt-1 text-[10px] text-muted-foreground'>
        {formatDistanceToNow(message.createdAt, { addSuffix: true })}
      </p>
    </div>
  )
}
