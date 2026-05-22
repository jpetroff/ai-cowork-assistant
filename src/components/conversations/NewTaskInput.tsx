import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpIcon } from '@phosphor-icons/react'
import { useConversationStore } from '@/components/conversations/conversationStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
    <div className='relative rounded-card ring-1 ring-foreground/10 bg-card focus-within:ring-foreground/30 transition-shadow'>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder='What would you like to work on?'
        rows={3}
        disabled={submitting}
        className={cn(
          'min-h-28 w-full resize-none border-0 bg-transparent px-surface-card-lg pt-surface-card-lg pb-16 type-ui-lg outline-none shadow-none focus-visible:ring-0',
          'placeholder:text-muted-foreground disabled:opacity-50',
          'max-h-[8rem] overflow-y-auto'
        )}
        style={{ fieldSizing: 'content' } as React.CSSProperties}
      />
      <div className='absolute bottom-4 right-4 flex items-center gap-3'>
        <span className='text-muted-foreground type-ui-xs hidden sm:block'>
          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+↵
        </span>
        <Button
          size='icon'
          onClick={handleSubmit}
          disabled={isEmpty || submitting}
          aria-label='Start task'
        >
          <ArrowUpIcon className='size-icon-md' />
        </Button>
      </div>
    </div>
  )
}
