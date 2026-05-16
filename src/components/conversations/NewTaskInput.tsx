import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpIcon } from '@phosphor-icons/react'
import { useConversationStore } from '@/components/conversations/conversationStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface NewTaskInputProps {
  projectId: string
}

export function NewTaskInput({ projectId }: NewTaskInputProps) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const navigate = useNavigate()
  const createConversation = useConversationStore((s) => s.create)

  const isEmpty = value.trim().length === 0

  async function handleSubmit() {
    if (isEmpty || submitting) return
    setSubmitting(true)
    const conversation = await createConversation(projectId)
    if (conversation) {
      navigate(`/projects/${projectId}/chats/${conversation.id}`, {
        state: { initialMessage: value.trim() },
      })
    }
    setSubmitting(false)
    setValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className='relative rounded-none ring-1 ring-foreground/10 bg-card focus-within:ring-foreground/30 transition-shadow'>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder='What would you like to work on?'
        rows={3}
        disabled={submitting}
        className={cn(
          'w-full resize-none bg-transparent px-4 pt-4 pb-12 text-sm outline-none',
          'placeholder:text-muted-foreground disabled:opacity-50',
          'max-h-[8rem] overflow-y-auto'
        )}
        style={{ fieldSizing: 'content' } as React.CSSProperties}
      />
      <div className='absolute bottom-3 right-3 flex items-center gap-2'>
        <span className='text-muted-foreground text-xs hidden sm:block'>
          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+↵
        </span>
        <Button
          size='icon-sm'
          onClick={handleSubmit}
          disabled={isEmpty || submitting}
          aria-label='Start task'
        >
          <ArrowUpIcon className='size-3.5' />
        </Button>
      </div>
    </div>
  )
}
