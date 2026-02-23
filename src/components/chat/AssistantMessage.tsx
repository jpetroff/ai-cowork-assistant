import type { ChatMessage } from '@/lib/chat/types'
import { ThinkingBlock } from './ThinkingBlock'
import { ProgressEvent } from './ProgressEvent'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'

export function AssistantMessage({ message }: { message: ChatMessage }) {
  const isStreaming = message.status === 'streaming'

  return (
    <div className='space-y-1'>
      {message.events?.map((event, i) => (
        <ProgressEvent key={i} event={event} />
      ))}

      {message.thinking && (
        <ThinkingBlock content={message.thinking} isStreaming={isStreaming} />
      )}

      {message.content && (
        <div className='text-sm whitespace-pre-wrap'>{message.content}</div>
      )}

      {message.hasArtifact && (
        <Badge variant='secondary' className='text-[10px] gap-1'>
          <FileText className='size-3' />
          Document created
        </Badge>
      )}

      {message.status === 'error' && (
        <div className='text-xs text-destructive'>{message.content}</div>
      )}
    </div>
  )
}
