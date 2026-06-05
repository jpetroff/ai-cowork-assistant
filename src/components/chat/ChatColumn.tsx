import { ChatColumnHeader } from './ChatColumnHeader'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { GenerationDrawerProvider } from './GenerationSteps'

interface ChatColumnProps {
  projectId: string
}

export function ChatColumn({ projectId }: ChatColumnProps) {
  return (
    <div className='flex h-full flex-col'>
      <ChatColumnHeader projectId={projectId} />
      <GenerationDrawerProvider>
        <MessageList />
        <ChatInput />
      </GenerationDrawerProvider>
    </div>
  )
}
