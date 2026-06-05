import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquarePlus } from 'lucide-react'
import { useConversationStore } from '@/components/conversations/conversationStore'
import { Button } from '@/components/ui/button'

/** @property projectId - Project that receives the new empty chat. */
interface CreateEmptyChatButtonProps {
  projectId: string
}

export function CreateEmptyChatButton({
  projectId,
}: CreateEmptyChatButtonProps) {
  const [creating, setCreating] = useState(false)
  const createConversation = useConversationStore((s) => s.create)
  const navigate = useNavigate()

  async function handleCreate() {
    if (creating) return
    setCreating(true)
    try {
      const conversation = await createConversation(projectId)
      if (conversation) {
        navigate(`/projects/${projectId}/chats/${conversation.id}`)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      onClick={handleCreate}
      disabled={creating}
      className='self-start'
    >
      <MessageSquarePlus className='size-icon-sm' />
      New empty chat
    </Button>
  )
}
