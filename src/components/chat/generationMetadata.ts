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
/** @property stream - durable streaming lifecycle metadata */
export interface MessageMetadata {
  generation?: GenerationMetadata
  stream?: StreamMetadata
  [key: string]: unknown
}

export type StreamStatus = 'active' | 'complete' | 'interrupted' | 'error'

/** @property status - durable lifecycle for a streamed assistant attempt */
/** @property jobId - in-memory/background job identifier */
/** @property sourceUserMessageId - user message that prompted this attempt */
/** @property targetArtifactId - artifact receiving streamed AI revision output */
/** @property artifactRevisionId - AI revision created for streamed artifact output */
/** @property startedAt - epoch milliseconds when streaming began */
/** @property updatedAt - epoch milliseconds when streaming last changed */
/** @property completedAt - epoch milliseconds when streaming finished */
/** @property error - user-visible stream failure reason */
export interface StreamMetadata {
  status: StreamStatus
  jobId: string
  sourceUserMessageId: string
  targetArtifactId: string | null
  artifactRevisionId?: string
  startedAt: number
  updatedAt: number
  completedAt?: number
  error?: string
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

export function getStreamMetadata(
  metadata: string | null
): StreamMetadata | null {
  const stream = parseMessageMetadata(metadata).stream
  if (!isStreamMetadata(stream)) return null

  return stream
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

function isStreamMetadata(value: unknown): value is StreamMetadata {
  if (!isRecord(value)) return false

  return (
    (value.status === 'active' ||
      value.status === 'complete' ||
      value.status === 'interrupted' ||
      value.status === 'error') &&
    typeof value.jobId === 'string' &&
    typeof value.sourceUserMessageId === 'string' &&
    (typeof value.targetArtifactId === 'string' ||
      value.targetArtifactId === null) &&
    typeof value.startedAt === 'number' &&
    typeof value.updatedAt === 'number'
  )
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
