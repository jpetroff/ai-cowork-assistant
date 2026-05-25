import { Dialog } from '@base-ui/react/dialog'
import { createContext, useContext, useRef, type ReactNode } from 'react'
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  formatGenerationDuration,
  type GenerationMetadata,
  type GenerationStep,
} from './generationMetadata'
import { cn } from '@/lib/utils'
import { XIcon } from 'lucide-react'

const GenerationDrawerContainerContext =
  createContext<React.RefObject<HTMLDivElement | null> | null>(null)

export function GenerationDrawerProvider({
  children,
}: {
  children: ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <GenerationDrawerContainerContext.Provider value={containerRef}>
      <div ref={containerRef} className='relative flex min-h-0 flex-1 flex-col'>
        {children}
      </div>
    </GenerationDrawerContainerContext.Provider>
  )
}

interface GenerationStepTriggerProps {
  generation: GenerationMetadata
  isStreaming?: boolean
}

export function GenerationStepTrigger({
  generation,
  isStreaming = false,
}: GenerationStepTriggerProps) {
  const activeStep = generation.steps[generation.steps.length - 1]
  const title = isStreaming
    ? (activeStep?.title ?? 'Thinking')
    : formatGenerationDuration(generation.durationMs)

  return (
    <Dialog.Root modal={false}>
      <Dialog.Trigger
        className={cn(
          'mt-2 inline-flex max-w-full cursor-pointer items-center rounded-control px-0 py-control-y-sm type-ui-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isStreaming && 'generation-shimmer font-medium'
        )}
      >
        <span className='truncate'>{title}</span>
      </Dialog.Trigger>
      <GenerationStepsSheet generation={generation} />
    </Dialog.Root>
  )
}

function GenerationStepsSheet({
  generation,
}: {
  generation: GenerationMetadata
}) {
  const containerRef = useContext(GenerationDrawerContainerContext)

  return (
    <Dialog.Portal container={containerRef?.current ?? undefined}>
      <Dialog.Backdrop className='absolute inset-0 z-30 bg-background/60 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0' />
      <Dialog.Popup className='absolute inset-x-0 bottom-0 z-40 flex max-h-[75%] flex-col border-t bg-popover bg-clip-padding type-ui-md text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:translate-y-[2.5rem] data-ending-style:opacity-0 data-starting-style:translate-y-[2.5rem] data-starting-style:opacity-0'>
        <SheetHeader>
          <SheetTitle>Generation steps</SheetTitle>
          <SheetDescription>
            {formatGenerationDuration(generation.durationMs)}
          </SheetDescription>
        </SheetHeader>
        <div className='min-h-0 overflow-y-auto px-surface-card-lg pb-surface-card-lg'>
          <ol className='space-y-surface-card'>
            {generation.steps.map((step, index) => (
              <GenerationStepItem key={step.id} step={step} index={index} />
            ))}
          </ol>
        </div>
        <Dialog.Close
          render={
            <Button
              variant='ghost'
              className='absolute top-4 right-4'
              size='icon-sm'
            />
          }
        >
          <XIcon />
          <span className='sr-only'>Close</span>
        </Dialog.Close>
      </Dialog.Popup>
    </Dialog.Portal>
  )
}

function GenerationStepItem({
  step,
  index,
}: {
  step: GenerationStep
  index: number
}) {
  const details = formatPayload(step.payload)

  return (
    <li className='rounded-card border bg-card p-surface-card text-card-foreground'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='m-0 type-ui-md font-medium text-foreground'>
            {index + 1}. {step.title}
          </p>
          <p className='m-0 type-ui-xs text-muted-foreground'>
            {formatStepDuration(step)}
          </p>
        </div>
        <span className='shrink-0 rounded-pill bg-muted px-control-x-sm py-control-y-sm type-ui-xs text-muted-foreground'>
          {step.kind}
        </span>
      </div>
      {step.content && (
        <p className='mt-3 whitespace-pre-wrap wrap-break-word type-ui-sm text-foreground'>
          {step.content}
        </p>
      )}
      {details && (
        <pre className='mt-3 max-h-64 overflow-auto rounded-card bg-muted p-surface-card type-ui-xs text-muted-foreground'>
          {details}
        </pre>
      )}
    </li>
  )
}

function formatStepDuration(step: GenerationStep) {
  if (step.durationMs == null) return 'In progress'

  return formatGenerationDuration(step.durationMs).replace('Thought for ', '')
}

function formatPayload(payload: unknown) {
  if (payload == null) return null

  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}
