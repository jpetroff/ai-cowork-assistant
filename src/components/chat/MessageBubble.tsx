import type { Message } from '@/lib/db/types'
import { cn } from '@/lib/utils'
import { GenerationStepTrigger } from './GenerationSteps'
import { getGenerationMetadata } from './generationMetadata'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const generation = isUser ? null : getGenerationMetadata(message.metadata)

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-card px-surface-card py-control-y-md type-ui-md',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground prose prose-sm dark:prose-invert'
        )}
      >
        <p className='whitespace-pre-wrap wrap-break-word m-0'>
          {message.content}
        </p>
        {generation && <GenerationStepTrigger generation={generation} />}
      </div>
    </div>
  )
}
