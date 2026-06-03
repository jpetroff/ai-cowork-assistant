import { LoaderCircle, RefreshCw } from 'lucide-react'
import type { Message } from '@/lib/db/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useBackgroundGenerationStore } from './backgroundGenerationStore'
import { GenerationStepTrigger } from './GenerationSteps'
import { getGenerationMetadata, getStreamMetadata } from './generationMetadata'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const generation = isUser ? null : getGenerationMetadata(message.metadata)
  const stream = isUser ? null : getStreamMetadata(message.metadata)
  const regenerate = useBackgroundGenerationStore((s) => s.regenerate)
  const isActive = stream?.status === 'active'
  const canRegenerate =
    stream?.status === 'interrupted' || stream?.status === 'error'

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
        {message.content ? (
          <p className='whitespace-pre-wrap wrap-break-word m-0'>
            {message.content}
          </p>
        ) : (
          isActive && (
            <p className='m-0 inline-flex items-center gap-2 text-muted-foreground'>
              <LoaderCircle className='size-icon-sm animate-spin' />
              Writing
            </p>
          )
        )}
        {generation && (
          <GenerationStepTrigger
            generation={generation}
            isStreaming={isActive}
          />
        )}
        {canRegenerate && (
          <div className='mt-3 flex items-center gap-2 text-muted-foreground'>
            <span className='type-ui-sm'>
              {stream.status === 'error'
                ? (stream.error ?? 'Generation failed.')
                : 'Generation interrupted.'}
            </span>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => void regenerate(message.id)}
            >
              <RefreshCw className='size-icon-sm' />
              Regenerate
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
