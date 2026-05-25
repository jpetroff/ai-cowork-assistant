/** @property id - stable step identifier within a generation */
/** @property kind - source event category */
/** @property title - visible step label */
/** @property content - optional streamed step text */
/** @property payload - optional sanitized event payload */
/** @property startedAt - epoch milliseconds when the step began */
/** @property endedAt - epoch milliseconds when the step ended */
/** @property durationMs - step duration in milliseconds */
export interface GenerationStep {
  id: string
  kind: 'thinking' | 'event'
  title: string
  content?: string
  payload?: unknown
  startedAt: number
  endedAt?: number
  durationMs?: number
}

/** @property startedAt - epoch milliseconds when generation began */
/** @property completedAt - epoch milliseconds when generation completed */
/** @property durationMs - total generation duration in milliseconds */
/** @property steps - ordered generation step timeline */
export interface GenerationMetadata {
  startedAt: number
  completedAt?: number
  durationMs?: number
  steps: GenerationStep[]
}

/** @property generation - assistant generation step timeline */
export interface MessageMetadata {
  generation?: GenerationMetadata
  [key: string]: unknown
}

export function parseMessageMetadata(metadata: string | null): MessageMetadata {
  if (!metadata) return {}

  try {
    const parsed = JSON.parse(metadata) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function getGenerationMetadata(
  metadata: string | null
): GenerationMetadata | null {
  const generation = parseMessageMetadata(metadata).generation
  if (!isGenerationMetadata(generation)) return null

  return generation
}

export function formatGenerationDuration(durationMs: number | undefined) {
  if (durationMs == null || !Number.isFinite(durationMs)) return 'Thought'

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  if (totalSeconds < 60) {
    return `Thought for ${totalSeconds} sec`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (seconds === 0) {
    return `Thought for ${minutes} min`
  }

  return `Thought for ${minutes} min ${seconds} sec`
}

function isGenerationMetadata(value: unknown): value is GenerationMetadata {
  if (!isRecord(value)) return false
  if (typeof value.startedAt !== 'number') return false
  if (!Array.isArray(value.steps)) return false

  return value.steps.every(isGenerationStep)
}

function isGenerationStep(value: unknown): value is GenerationStep {
  if (!isRecord(value)) return false

  return (
    typeof value.id === 'string' &&
    (value.kind === 'thinking' || value.kind === 'event') &&
    typeof value.title === 'string' &&
    typeof value.startedAt === 'number'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
