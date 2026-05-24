import { create } from 'zustand'
import { useArtifactStore } from '@/components/editor/artifactStore'
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
        artifact: sealResult
          ? {
              artifact_id: sealResult.artifactId,
              revision_id: sealResult.revisionId,
              content: sealResult.content,
            }
          : null,
      }

      messageStore.beginStreaming()
      const streamResult = await useSidecarStore
        .getState()
        .sendChatRequest(requestBody, {
          onChunk: (chunk) => useMessageStore.getState().appendChunk(chunk),
        })

      if (!streamResult) {
        await useMessageStore.getState().finalizeStreaming(null, '')
        return
      }

      const finalMessageId = await useMessageStore
        .getState()
        .finalizeStreaming(streamResult.messageId, streamResult.content)

      if (finalMessageId && streamResult.artifactContent !== null) {
        await useArtifactStore
          .getState()
          .applyAiRevision(
            streamResult.artifactContent,
            finalMessageId,
            artifactUpdateTargetId ?? undefined
          )
      }

      console_if('CHAT_SESSION').log('[CHAT_SESSION] submit:done', {
        conversationId,
        finalMessageId,
        hasArtifactContent: streamResult.artifactContent !== null,
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
