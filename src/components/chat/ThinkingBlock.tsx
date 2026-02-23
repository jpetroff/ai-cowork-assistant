import { useState, useEffect } from 'react'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { Brain, ChevronDown } from 'lucide-react'

export function ThinkingBlock({
  content,
  isStreaming,
}: {
  content: string
  isStreaming: boolean
}) {
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    if (!isStreaming && isOpen) {
      const timer = setTimeout(() => setIsOpen(false), 500)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, isOpen])

  if (!content) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className='flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1'>
        <Brain className='size-3' />
        <span>{isStreaming ? 'Thinking...' : 'Thought process'}</span>
        <ChevronDown
          className={`size-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className='text-xs text-muted-foreground italic pl-5 py-1'>
        {content}
      </CollapsibleContent>
    </Collapsible>
  )
}
