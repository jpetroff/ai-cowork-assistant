import { create } from 'zustand'
import { useArtifactStore } from '@/components/editor/artifactStore'
import { useNotificationStore } from '@/components/ui/notificationStore'
import {
  getConversation,
  setConversationActiveArtifact,
} from '@/lib/db/repositories/conversations'
import { getArtifact } from '@/lib/db/repositories/documents'
import {
  createMessage,
  getMessage,
  listMessages,
  listMessagesWithStreamStatus,
  updateMessageContentAndMetadata,
} from '@/lib/db/repositories/messages'
import {
  createRevision,
  updateRevisionContent,
} from '@/lib/db/repositories/revisions'
import type { Artifact, ArtifactRevision, Message } from '@/lib/db/types'
import type { SealResult } from '@/lib/types'
import { console_if } from '@/lib/logger'
import { isViewingChatRoute } from '@/lib/routePresence'
import {
  getStreamMetadata,
  parseMessageMetadata,
  type GenerationMetadata,
  type MessageMetadata,
  type StreamMetadata,
} from './generationMetadata'
import { resolveLlmProviderSettings } from './llmProviderSettings'
import { useMessageStore } from './messageStore'
import { useSidecarStore, type ChatCompletionRequest } from './sidecarStore'

/** @property artifactId - artifact selected as context for one outgoing message */
export interface BackgroundSubmitArtifactContext {
  artifactId: string
}

/** @property projectId - project that owns the conversation */
/** @property conversationId - conversation receiving the assistant attempt */
/** @property content - user message text */
/** @property artifactContext - artifact context override for the request */
interface StartGenerationParams {
  projectId: string
  conversationId: string
  content: string
  artifactContext?: BackgroundSubmitArtifactContext | null
}

/** @property activeJobs - currently running jobs keyed by conversation id */
interface BackgroundGenerationState {
  activeJobs: Record<string, BackgroundGenerationJob>
}

interface BackgroundGenerationActions {
  startMessage: (params: StartGenerationParams) => Promise<void>
  regenerate: (assistantMessageId: string) => Promise<void>
  recoverInterruptedStreams: () => Promise<void>
}

interface BackgroundGenerationJob {
  jobId: string
  projectId: string
  conversationId: string
  sourceUserMessageId: string
  targetArtifactId: string | null
  currentAssistantMessage: Message | null
  artifactRevision: ArtifactRevision | null
  artifactContent: string
  messageContent: string
  generation: GenerationMetadata
  startedAt: number
  nextSequenceOrder: number
}

interface PreparedGeneration {
  requestBody: ChatCompletionRequest
  targetArtifactId: string | null
  nextSequenceOrder: number
}

export const useBackgroundGenerationStore = create<
  BackgroundGenerationState & BackgroundGenerationActions
>((set, get) => ({
  activeJobs: {},

  async startMessage({ projectId, conversationId, content, artifactContext }) {
    const text = content.trim()
    if (!text) return
    ensureConversationIsIdle(conversationId)

    const llmProvider = resolveLlmProviderSettings(projectId)
    const messagesBefore = await listMessages(conversationId)
    const userSequenceOrder = getNextSequenceOrder(messagesBefore)
    const userMessageId = await createMessage({
      conversation_id: conversationId,
      role: 'user',
      content: text,
      sequence_order: userSequenceOrder,
    })
    const userMessage = buildMessage({
      id: userMessageId,
      conversationId,
      role: 'user',
      content: text,
      sequenceOrder: userSequenceOrder,
      metadata: null,
    })
    useMessageStore.getState().upsertMessage(userMessage)

    const prepared = await prepareGeneration({
      projectId,
      conversationId,
      sourceUserMessageId: userMessageId,
      sourceText: text,
      messagesBefore,
      llmProvider,
      artifactContext,
      nextSequenceOrder: userSequenceOrder + 1,
    })

    const job = await createJob({
      projectId,
      conversationId,
      sourceUserMessageId: userMessageId,
      targetArtifactId: prepared.targetArtifactId,
      nextSequenceOrder: prepared.nextSequenceOrder,
    })

    setJob(job)
    void runJob(job, prepared.requestBody)
  },

  async regenerate(assistantMessageId) {
    const assistantMessage = await getMessage(assistantMessageId)
    const stream = getStreamMetadata(assistantMessage?.metadata ?? null)
    if (!assistantMessage || !stream) return
    ensureConversationIsIdle(assistantMessage.conversation_id)

    const sourceMessage = await getMessage(stream.sourceUserMessageId)
    if (!sourceMessage || sourceMessage.role !== 'user') return

    const conversation = await getConversation(assistantMessage.conversation_id)
    if (!conversation) return

    const messagesBefore = (await listMessages(conversation.id)).filter(
      (message) => message.sequence_order < sourceMessage.sequence_order
    )
    const llmProvider = resolveLlmProviderSettings(conversation.project_id)
    const nextSequenceOrder = getNextSequenceOrder(
      await listMessages(conversation.id)
    )
    const artifactContext = stream.targetArtifactId
      ? { artifactId: stream.targetArtifactId }
      : null
    const prepared = await prepareGeneration({
      projectId: conversation.project_id,
      conversationId: conversation.id,
      sourceUserMessageId: sourceMessage.id,
      sourceText: sourceMessage.content,
      messagesBefore,
      llmProvider,
      artifactContext,
      nextSequenceOrder,
    })
    const job = await createJob({
      projectId: conversation.project_id,
      conversationId: conversation.id,
      sourceUserMessageId: sourceMessage.id,
      targetArtifactId: prepared.targetArtifactId,
      nextSequenceOrder: prepared.nextSequenceOrder,
    })

    setJob(job)
    void runJob(job, prepared.requestBody)
  },

  async recoverInterruptedStreams() {
    const activeMessages = await listMessagesWithStreamStatus('active')
    const now = Date.now()

    await Promise.all(
      activeMessages.map(async (message) => {
        if (get().activeJobs[message.conversation_id]) return

        const metadata = parseMessageMetadata(message.metadata)
        const stream = metadata.stream
        if (!stream) return

        await updateMessageContentAndMetadata(message.id, message.content, {
          ...metadata,
          stream: {
            ...stream,
            status: 'interrupted',
            updatedAt: now,
            completedAt: now,
            error: 'Generation was interrupted before it completed.',
          },
        })
      })
    )
  },
}))

async function prepareGeneration({
  conversationId,
  sourceUserMessageId,
  sourceText,
  messagesBefore,
  llmProvider,
  artifactContext,
  nextSequenceOrder,
}: {
  projectId: string
  conversationId: string
  sourceUserMessageId: string
  sourceText: string
  messagesBefore: Message[]
  llmProvider: ChatCompletionRequest['llm_provider']
  artifactContext?: BackgroundSubmitArtifactContext | null
  nextSequenceOrder: number
}): Promise<PreparedGeneration> {
  const artifactStore = useArtifactStore.getState()
  const requestedArtifactId =
    artifactContext === undefined
      ? (artifactStore.artifact?.id ?? null)
      : (artifactContext?.artifactId ?? null)
  const sealResult =
    artifactContext === undefined
      ? await artifactStore.sealForSend(sourceUserMessageId)
      : artifactContext
        ? await artifactStore.getArtifactContextForSend(
            artifactContext.artifactId,
            sourceUserMessageId
          )
        : null
  let targetArtifactId = sealResult?.artifactId ?? requestedArtifactId
  const activeArtifactId = useArtifactStore.getState().artifact?.id ?? null

  if (sealResult && activeArtifactId !== sealResult.artifactId) {
    await useArtifactStore.getState().requestArtifactLoad(sealResult.artifactId)
  } else if (!sealResult && requestedArtifactId === null) {
    targetArtifactId = await useArtifactStore
      .getState()
      .createNewArtifact(conversationId)
  }

  if (targetArtifactId) {
    await setConversationActiveArtifact(conversationId, targetArtifactId)
  }

  return {
    targetArtifactId,
    nextSequenceOrder,
    requestBody: {
      message: sourceText,
      chat_history: messagesBefore
        .filter(isMessageUsableForHistory)
        .map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        })),
      llm_provider: llmProvider,
      artifact: sealResult
        ? {
            artifact_id: sealResult.artifactId,
            revision_id: sealResult.revisionId,
            content: sealResult.content,
          }
        : null,
    },
  }
}

async function createJob({
  projectId,
  conversationId,
  sourceUserMessageId,
  targetArtifactId,
  nextSequenceOrder,
}: {
  projectId: string
  conversationId: string
  sourceUserMessageId: string
  targetArtifactId: string | null
  nextSequenceOrder: number
}): Promise<BackgroundGenerationJob> {
  const startedAt = Date.now()
  const jobId = crypto.randomUUID()
  const generation = { startedAt, steps: [] }
  const stream = createStreamMetadata({
    jobId,
    sourceUserMessageId,
    targetArtifactId,
    startedAt,
  })
  const assistantMessageId = await createMessage({
    conversation_id: conversationId,
    role: 'assistant',
    content: '',
    metadata: { generation, stream },
    sequence_order: nextSequenceOrder,
  })
  const assistantMessage = buildMessage({
    id: assistantMessageId,
    conversationId,
    role: 'assistant',
    content: '',
    sequenceOrder: nextSequenceOrder,
    metadata: { generation, stream },
  })
  useMessageStore.getState().upsertMessage(assistantMessage)

  return {
    jobId,
    projectId,
    conversationId,
    sourceUserMessageId,
    targetArtifactId,
    currentAssistantMessage: assistantMessage,
    artifactRevision: null,
    artifactContent: '',
    messageContent: '',
    generation,
    startedAt,
    nextSequenceOrder: nextSequenceOrder + 1,
  }
}

async function runJob(
  job: BackgroundGenerationJob,
  requestBody: ChatCompletionRequest
) {
  console_if('BACKGROUND_GENERATION').log('[BACKGROUND_GENERATION] job:start', {
    conversationId: job.conversationId,
    jobId: job.jobId,
  })

  let completed = false
  try {
    await useSidecarStore.getState().sendChatRequest(requestBody, {
      onChunk: async (chunk) => {
        const currentJob = await ensureAssistantMessage(job)
        currentJob.messageContent += chunk
        await persistAssistantMessage(currentJob, 'active')
      },
      onStep: async (generation) => {
        const currentJob = await ensureAssistantMessage(job)
        currentJob.generation = generation
        await persistAssistantMessage(currentJob, 'active')
      },
      onArtifactChunk: async (chunk) => {
        const currentJob = await ensureAssistantMessage(job)
        currentJob.artifactContent += chunk
        await persistArtifactRevision(currentJob)
      },
      onMessageComplete: async (message) => {
        const currentJob = await ensureAssistantMessage(job)
        currentJob.messageContent = message.content
        currentJob.generation = message.generation
        if (message.artifactContent !== null) {
          currentJob.artifactContent = message.artifactContent
          await persistArtifactRevision(currentJob)
        }
        await persistAssistantMessage(currentJob, 'complete')
        const completedMessageId =
          currentJob.currentAssistantMessage?.id ?? null
        currentJob.currentAssistantMessage = null
        currentJob.artifactRevision = null
        currentJob.artifactContent = ''
        currentJob.messageContent = ''
        completed = true
        return completedMessageId
      },
    })
    if (completed) {
      await notifyJobComplete(job).catch((err) => {
        console.error(
          '[BACKGROUND_GENERATION] completion notification failed',
          err
        )
      })
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Generation failed while streaming.'
    await persistAssistantMessage(job, 'error', message)
    await notifyJobError(job, message).catch((notificationErr) => {
      console.error(
        '[BACKGROUND_GENERATION] error notification failed',
        notificationErr
      )
    })
  } finally {
    clearJob(job.conversationId)
  }
}

async function notifyJobComplete(job: BackgroundGenerationJob) {
  if (isViewingChatRoute(job.projectId, job.conversationId)) return

  const conversation = await getConversation(job.conversationId)
  const title = conversation?.title?.trim()
  const message = title
    ? `Background job finished in ${title}`
    : 'Background job finished'

  useNotificationStore.getState().push({
    kind: 'success',
    message,
    action: {
      label: 'View',
      to: `/projects/${job.projectId}/chats/${job.conversationId}`,
    },
  })
}

async function notifyJobError(job: BackgroundGenerationJob, error: string) {
  if (isViewingChatRoute(job.projectId, job.conversationId)) return

  const conversation = await getConversation(job.conversationId)
  const title = conversation?.title?.trim()
  const message = title
    ? `Background job failed in ${title}`
    : 'Background job failed'

  useNotificationStore.getState().push({
    kind: 'error',
    message,
    detail: error,
    action: {
      label: 'View',
      to: `/projects/${job.projectId}/chats/${job.conversationId}`,
    },
  })
}

async function ensureAssistantMessage(job: BackgroundGenerationJob) {
  if (job.currentAssistantMessage) return job

  const startedAt = Date.now()
  job.startedAt = startedAt
  job.generation = { startedAt, steps: [] }
  job.artifactContent = ''
  job.messageContent = ''
  const stream = createStreamMetadata({
    jobId: job.jobId,
    sourceUserMessageId: job.sourceUserMessageId,
    targetArtifactId: job.targetArtifactId,
    startedAt,
  })
  const assistantMessageId = await createMessage({
    conversation_id: job.conversationId,
    role: 'assistant',
    content: '',
    metadata: { generation: job.generation, stream },
    sequence_order: job.nextSequenceOrder,
  })
  job.currentAssistantMessage = buildMessage({
    id: assistantMessageId,
    conversationId: job.conversationId,
    role: 'assistant',
    content: '',
    sequenceOrder: job.nextSequenceOrder,
    metadata: { generation: job.generation, stream },
  })
  job.nextSequenceOrder += 1
  useMessageStore.getState().upsertMessage(job.currentAssistantMessage)
  setJob(job)

  return job
}

async function persistAssistantMessage(
  job: BackgroundGenerationJob,
  status: StreamMetadata['status'],
  error?: string
) {
  const message = job.currentAssistantMessage
  if (!message) return

  const now = Date.now()
  const metadata = buildMetadata(job, status, now, error)
  const content = job.messageContent
  await updateMessageContentAndMetadata(message.id, content, metadata)
  const updatedMessage = {
    ...message,
    content,
    metadata: JSON.stringify(metadata),
  }
  job.currentAssistantMessage = updatedMessage
  useMessageStore.getState().patchMessage(updatedMessage)
  setJob(job)
}

async function persistArtifactRevision(job: BackgroundGenerationJob) {
  if (!job.targetArtifactId) return

  const artifact = await getArtifact(job.targetArtifactId)
  if (!artifact || !job.currentAssistantMessage) return

  const now = Date.now()
  console_if('BACKGROUND_GENERATION').log(
    '[BACKGROUND_GENERATION] artifact-revision:persist',
    {
      artifactId: artifact.id,
      assistantMessageId: job.currentAssistantMessage.id,
      existingRevisionId: job.artifactRevision?.id ?? null,
      contentLength: job.artifactContent.length,
    }
  )
  if (!job.artifactRevision) {
    const revisionId = await createRevision({
      artifact_id: artifact.id,
      author: 'ai',
      content: job.artifactContent,
      message_id: job.currentAssistantMessage.id,
    })
    job.artifactRevision = {
      id: revisionId,
      artifact_id: artifact.id,
      message_id: job.currentAssistantMessage.id,
      author: 'ai',
      content: job.artifactContent,
      created_at: now,
      updated_at: now,
    }
    console_if('BACKGROUND_GENERATION').log(
      '[BACKGROUND_GENERATION] artifact-revision:created',
      {
        artifactId: artifact.id,
        revisionId,
        assistantMessageId: job.currentAssistantMessage.id,
        contentLength: job.artifactContent.length,
      }
    )
  } else if (job.artifactRevision.content === job.artifactContent) {
    console_if('BACKGROUND_GENERATION').log(
      '[BACKGROUND_GENERATION] artifact-revision:unchanged',
      {
        artifactId: artifact.id,
        revisionId: job.artifactRevision.id,
        assistantMessageId: job.currentAssistantMessage.id,
        contentLength: job.artifactContent.length,
      }
    )
    return
  } else {
    await updateRevisionContent(job.artifactRevision.id, job.artifactContent)
    job.artifactRevision = {
      ...job.artifactRevision,
      content: job.artifactContent,
      updated_at: now,
    }
    console_if('BACKGROUND_GENERATION').log(
      '[BACKGROUND_GENERATION] artifact-revision:updated',
      {
        artifactId: artifact.id,
        revisionId: job.artifactRevision.id,
        assistantMessageId: job.currentAssistantMessage.id,
        contentLength: job.artifactContent.length,
      }
    )
  }

  useArtifactStore
    .getState()
    .upsertStreamingAiRevision(artifact, job.artifactRevision)
  await persistAssistantMessage(job, 'active')
}

function buildMetadata(
  job: BackgroundGenerationJob,
  status: StreamMetadata['status'],
  updatedAt: number,
  error?: string
): MessageMetadata {
  const existing = parseMessageMetadata(
    job.currentAssistantMessage?.metadata ?? null
  )
  const completedAt =
    status === 'complete' || status === 'error' ? updatedAt : undefined

  return {
    ...existing,
    generation:
      status === 'complete' || status === 'error'
        ? {
            ...job.generation,
            completedAt: job.generation.completedAt ?? updatedAt,
            durationMs: Math.max(0, updatedAt - job.generation.startedAt),
          }
        : job.generation,
    stream: {
      ...(existing.stream ??
        createStreamMetadata({
          jobId: job.jobId,
          sourceUserMessageId: job.sourceUserMessageId,
          targetArtifactId: job.targetArtifactId,
          startedAt: job.startedAt,
        })),
      status,
      targetArtifactId: job.targetArtifactId,
      artifactRevisionId: job.artifactRevision?.id,
      updatedAt,
      completedAt,
      error,
    },
  }
}

function createStreamMetadata({
  jobId,
  sourceUserMessageId,
  targetArtifactId,
  startedAt,
}: {
  jobId: string
  sourceUserMessageId: string
  targetArtifactId: string | null
  startedAt: number
}): StreamMetadata {
  return {
    status: 'active',
    jobId,
    sourceUserMessageId,
    targetArtifactId,
    startedAt,
    updatedAt: startedAt,
  }
}

function buildMessage({
  id,
  conversationId,
  role,
  content,
  sequenceOrder,
  metadata,
}: {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  sequenceOrder: number
  metadata: MessageMetadata | null
}): Message {
  return {
    id,
    conversation_id: conversationId,
    role,
    content,
    metadata: metadata ? JSON.stringify(metadata) : null,
    sequence_order: sequenceOrder,
    created_at: Date.now(),
  }
}

function isMessageUsableForHistory(message: Message) {
  if (message.role === 'system') return false
  if (message.role === 'user') return true

  const stream = getStreamMetadata(message.metadata)
  return !stream || stream.status === 'complete'
}

function getNextSequenceOrder(messages: Message[]) {
  return messages.length > 0
    ? Math.max(...messages.map((message) => message.sequence_order)) + 1
    : 0
}

function ensureConversationIsIdle(conversationId: string) {
  if (useBackgroundGenerationStore.getState().activeJobs[conversationId]) {
    throw new Error('This conversation is already generating a response.')
  }
}

function setJob(job: BackgroundGenerationJob) {
  useBackgroundGenerationStore.setState((state) => ({
    activeJobs: {
      ...state.activeJobs,
      [job.conversationId]: { ...job },
    },
  }))
}

function clearJob(conversationId: string) {
  useBackgroundGenerationStore.setState((state) => {
    const { [conversationId]: _removed, ...activeJobs } = state.activeJobs
    return { activeJobs }
  })
}
