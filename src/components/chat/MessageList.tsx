import { useMessageStore } from '@/stores/stubs'
import { MessageListSkeleton } from './MessageListSkeleton'

export function MessageList() {
  const status = useMessageStore(s => s.status)

  if (status === 'loading') return <MessageListSkeleton />

  return (
    <div className="flex-1 p-4 text-muted-foreground text-sm">
      No messages yet.
    </div>
  )
}
