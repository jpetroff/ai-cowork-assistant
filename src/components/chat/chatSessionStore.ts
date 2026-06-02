import { create } from 'zustand'
import { useArtifactStore } from '@/components/editor/artifactStore'
import { useLlmProviderStore } from '@/components/projects/llmProviderStore'
import { useProjectSettingsStore } from '@/components/projects/projectSettingsStore'
import {
  getProviderType,
  parseProviderConfig,
} from '@/components/settings/providerConfig'
import { console_if } from '@/lib/logger'
import type { ChatCompletionRequest } from './sidecarStore'
import { useMessageStore } from './messageStore'
import { useSidecarStore } from './sidecarStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type StoreStatus = 'idle' | 'loading' | 'ready' | 'error'

/** @property artifactId - artifact selected as context for one outgoing message */
export interface SubmitArtifactContext {
  artifactId: string
}

/** @property projectId - project that owns the chat route */
/** @property conversationId - conversation loaded for chat */
interface LoadChatParams {
  projectId: string
  conversationId: string
}

/** @property status - lifecycle state for page-level chat orchestration */
/** @property activeProjectId - project currently associated with chat context */
/** @property activeConversationId - conversation currently associated with chat context */
/** @property isAssistantStreaming - true while sidecar response is streaming */
/** @property error - latest orchestration error message */
interface ChatSessionState {
  status: StoreStatus
  activeProjectId: string | null
  activeConversationId: string | null
  isAssistantStreaming: boolean
  error: string | null
}

interface ChatSessionActions {
  loadChat: (params: LoadChatParams) => Promise<void>
  createNewDocument: (conversationId: string) => Promise<string>
  submitMessage: (
    content: string,
    artifactContext?: SubmitArtifactContext | null
  ) => Promise<void>
  reset: () => void
}

const INITIAL_STATE: ChatSessionState = {
  status: 'idle',
  activeProjectId: null,
  activeConversationId: null,
  isAssistantStreaming: false,
  error: null,
}

function resolveLlmProviderSettings(
  projectId: string | null
): ChatCompletionRequest['llm_provider'] {
  const providers = useLlmProviderStore.getState().providers
  const projectConfig = projectId
    ? useProjectSettingsStore.getState().aiConfigs[projectId]
    : undefined
  const projectProvider = projectConfig?.provider_id
    ? providers.find((provider) => provider.id === projectConfig.provider_id)
    : undefined
  const provider =
    projectProvider ?? providers.find((candidate) => candidate.is_default === 1)

  if (!provider) {
    throw new Error('Configure an AI provider in Settings before chatting.')
  }

  const model = projectConfig?.model || provider.default_model
  if (!model) {
    throw new Error(
      'Select a model in Project AI Configuration or set a provider default model in Settings.'
    )
  }

  const config = parseProviderConfig(provider.config_json)

  return {
    provider_id: provider.id,
    provider_type: getProviderType(provider),
    name: provider.name,
    base_url: provider.base_url,
    api_key: provider.api_key,
    model,
    temperature: config.temperature ?? null,
    max_tokens: config.max_tokens ?? null,
    timeout: config.timeout ?? config.request_timeout ?? null,
    context_window: config.context_window ?? null,
    is_chat_model: config.is_chat_model ?? null,
    is_function_calling_model: config.is_function_calling_model ?? null,
    thinking: config.thinking ?? null,
    reasoning_effort: config.reasoning_effort ?? null,
    config: { ...config },
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useChatSessionStore = create<
  ChatSessionState & ChatSessionActions
>()((set, get) => ({
  ...INITIAL_STATE,

  /**
   * Loads the message and artifact domain stores for a chat route. This is the
   * explicit page-level relationship between chat thread state and editor state.
   */
  async loadChat({ projectId, conversationId }) {
    console_if('CHAT_SESSION').log('[CHAT_SESSION] load:start', {
      projectId,
      conversationId,
    })
    set({
      status: 'loading',
      activeProjectId: projectId,
      activeConversationId: conversationId,
      error: null,
    })

    try {
      await useMessageStore.getState().loadForConversation(conversationId)
      await useArtifactStore.getState().loadForConversation(conversationId)
      set({ status: 'ready' })
      console_if('CHAT_SESSION').log('[CHAT_SESSION] load:ready', {
        projectId,
        conversationId,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load chat session'
      set({ status: 'error', error: message })
      console.error('[CHAT_SESSION] load:error', message)
    }
  },

  /**
   * Creates a new document and makes it the active editor target.
   */
  async createNewDocument(conversationId) {
    return useArtifactStore.getState().createNewArtifact(conversationId)
  },

  /**
   * Coordinates the complete send flow: persist user message, seal artifact context,
   * stream sidecar output, finalize assistant message, then apply AI artifact output.
   */
  async submitMessage(content, artifactContext) {
    const text = content.trim()
    if (!text) return

    console_if('CHAT_SESSION').log('[CHAT_SESSION] submit:start', {
      conversationId: get().activeConversationId,
    })
    set({ isAssistantStreaming: true, error: null })

    const messageStore = useMessageStore.getState()
    const artifactStore = useArtifactStore.getState()

    try {
      const userMessageId = await messageStore.addUserMessage(text)
      if (!userMessageId) {
        throw new Error('No active conversation')
      }
      const requestedArtifactId =
        artifactContext === undefined
          ? (artifactStore.artifact?.id ?? null)
          : (artifactContext?.artifactId ?? null)
      const sealResult =
        artifactContext === undefined
          ? await artifactStore.sealForSend(userMessageId)
          : artifactContext
            ? await artifactStore.getArtifactContextForSend(
                artifactContext.artifactId,
                userMessageId
              )
            : null
      const refreshedMessages = useMessageStore.getState().messages
      const conversationId = useMessageStore.getState().conversationId

      if (!conversationId) {
        throw new Error('No active conversation')
      }

      let artifactUpdateTargetId = sealResult?.artifactId ?? requestedArtifactId
      const activeArtifactId = useArtifactStore.getState().artifact?.id ?? null

      if (sealResult && activeArtifactId !== sealResult.artifactId) {
        await useArtifactStore
          .getState()
          .requestArtifactLoad(sealResult.artifactId)
      } else if (!sealResult && requestedArtifactId === null) {
        artifactUpdateTargetId = await useArtifactStore
          .getState()
          .createNewArtifact(conversationId)
      }

      const chatHistory = refreshedMessages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        }))

      const requestBody: ChatCompletionRequest = {
        message: text,
        chat_history: chatHistory.slice(0, -1),
        llm_provider: resolveLlmProviderSettings(get().activeProjectId),
        artifact: sealResult
          ? {
              artifact_id: sealResult.artifactId,
              revision_id: sealResult.revisionId,
              content: sealResult.content,
            }
          : null,
      }

      messageStore.beginStreaming()
      let streamedArtifactContent = ''
      const streamResult = await useSidecarStore
        .getState()
        .sendChatRequest(requestBody, {
          onChunk: (chunk) => useMessageStore.getState().appendChunk(chunk),
          onStep: (generation) =>
            useMessageStore.getState().setStreamingGeneration(generation),
          onArtifactChunk: (chunk) => {
            streamedArtifactContent += chunk
            useArtifactStore
              .getState()
              .previewAiRevisionDraft(
                streamedArtifactContent,
                artifactUpdateTargetId ?? undefined
              )
          },
          onMessageComplete: async (message) => {
            const finalMessageId = await useMessageStore
              .getState()
              .finalizeStreaming(message.messageId, message.content, {
                generation: message.generation,
              })

            if (finalMessageId && message.artifactContent !== null) {
              await useArtifactStore
                .getState()
                .applyAiRevision(
                  message.artifactContent,
                  finalMessageId,
                  artifactUpdateTargetId ?? undefined
                )
            }

            streamedArtifactContent = ''
            useMessageStore.getState().beginStreaming()
            return finalMessageId
          },
        })

      if (!streamResult) {
        await useMessageStore.getState().finalizeStreaming(null, '')
        return
      }

      await useMessageStore.getState().finalizeStreaming(null, '')

      console_if('CHAT_SESSION').log('[CHAT_SESSION] submit:done', {
        conversationId,
        messageCount: streamResult.messages.length,
        hasArtifactContent: streamResult.messages.some(
          (message) => message.artifactContent !== null
        ),
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to submit message'
      set({ error: message })
      console.error('[CHAT_SESSION] submit:error', message)
      await useMessageStore.getState().finalizeStreaming(null, '')
    } finally {
      set({ isAssistantStreaming: false })
    }
  },

  /**
   * Clears page-level orchestration state. Domain stores keep their own reset/load
   * semantics so they remain independently testable.
   */
  reset() {
    set(INITIAL_STATE)
  },
}))
