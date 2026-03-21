import { ConversationListSkeleton } from './ConversationListSkeleton'
import { MessageList } from './MessageList'
import { EditorPanel } from '@/components/editor/EditorPanel'

export function ChatLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-64 border-r flex flex-col shrink-0">
        <ConversationListSkeleton />
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <MessageList />
      </div>
      <div className="w-1/2 border-l flex flex-col">
        <EditorPanel />
      </div>
    </div>
  )
}
