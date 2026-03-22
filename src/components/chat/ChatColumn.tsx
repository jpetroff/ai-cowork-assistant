import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMessageStore } from '@/stores/messageStore'
import { useConversationStore } from '@/stores/conversationStore'
import { ChatColumnHeader } from './ChatColumnHeader'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'

interface ChatColumnProps {
  projectId: string
}

export function ChatColumn({ projectId }: ChatColumnProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeConversationId } = useConversationStore()
  const { addUserMessage } = useMessageStore()

  // Handle initialMessage from router state (e.g. from NewTaskInput)
  useEffect(() => {
    const initialMessage = (location.state as { initialMessage?: string } | null)?.initialMessage
    if (!initialMessage || !activeConversationId) return

    // Clear router state to prevent replay on re-render
    navigate(location.pathname, { replace: true, state: null })
    addUserMessage(initialMessage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId])

  return (
    <div className="flex flex-col h-full">
      <ChatColumnHeader projectId={projectId} />
      <MessageList />
      <ChatInput />
    </div>
  )
}
