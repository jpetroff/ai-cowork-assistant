import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  formatGenerationDuration,
  type GenerationMetadata,
  type GenerationStep,
} from './generationMetadata'
import { cn } from '@/lib/utils'

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
    <Sheet>
      <SheetTrigger
        className={cn(
          'mt-2 inline-flex max-w-full cursor-pointer items-center rounded-control px-0 py-control-y-sm type-ui-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isStreaming && 'generation-shimmer font-medium'
        )}
      >
        <span className='truncate'>{title}</span>
      </SheetTrigger>
      <GenerationStepsSheet generation={generation} />
    </Sheet>
  )
}

function GenerationStepsSheet({
  generation,
}: {
  generation: GenerationMetadata
}) {
  return (
    <SheetContent side='bottom' className='max-h-[75vh]'>
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
    </SheetContent>
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
