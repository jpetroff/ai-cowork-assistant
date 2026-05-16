import { useConversationStore } from '@/components/conversations/conversationStore'
import { ConversationRow } from './ConversationRow'
import { ConversationListEmpty } from './ConversationListEmpty'

interface ConversationListProps {
  projectId: string
}

export function ConversationList({ projectId }: ConversationListProps) {
  const conversations = useConversationStore((s) => s.conversations)
  const status = useConversationStore((s) => s.status)

  if (status === 'loading') return null

  if (conversations.length === 0) {
    return <ConversationListEmpty />
  }

  return (
    <div className='flex flex-col'>
      <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide px-3 mb-1'>
        Recent chats
      </p>
      {conversations.map((conversation) => (
        <ConversationRow
          key={conversation.id}
          conversation={conversation}
          projectId={projectId}
        />
      ))}
    </div>
  )
}
