import { create } from 'zustand'
import { useArtifactStore } from '@/components/editor/artifactStore'
import { console_if } from '@/lib/logger'
import { useBackgroundGenerationStore } from './backgroundGenerationStore'
import { useMessageStore } from './messageStore'

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
      set({
        status: 'ready',
        isAssistantStreaming: Boolean(
          useBackgroundGenerationStore.getState().activeJobs[conversationId]
        ),
      })
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
   * Starts a background generation job for the active chat. The background store
   * owns durable message/revision updates after this action returns.
   */
  async submitMessage(content, artifactContext) {
    const text = content.trim()
    if (!text) return

    console_if('CHAT_SESSION').log('[CHAT_SESSION] submit:start', {
      conversationId: get().activeConversationId,
    })
    set({ error: null })

    try {
      const { activeProjectId, activeConversationId } = get()

      if (!activeProjectId || !activeConversationId) {
        throw new Error('No active conversation')
      }

      await useBackgroundGenerationStore.getState().startMessage({
        projectId: activeProjectId,
        conversationId: activeConversationId,
        content: text,
        artifactContext,
      })
      set({
        isAssistantStreaming: Boolean(
          useBackgroundGenerationStore.getState().activeJobs[
            activeConversationId
          ]
        ),
      })

      console_if('CHAT_SESSION').log('[CHAT_SESSION] submit:queued', {
        conversationId: activeConversationId,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to submit message'
      set({ error: message })
      console.error('[CHAT_SESSION] submit:error', message)
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

useBackgroundGenerationStore.subscribe((state) => {
  const conversationId = useChatSessionStore.getState().activeConversationId
  useChatSessionStore.setState({
    isAssistantStreaming: conversationId
      ? Boolean(state.activeJobs[conversationId])
      : false,
  })
})
