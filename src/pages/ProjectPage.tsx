import { Skeleton } from '@/components/ui/skeleton'
import { ConversationListSkeleton } from '@/components/chat/ConversationListSkeleton'

export function ProjectPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex-1 overflow-auto">
        <ConversationListSkeleton />
      </div>
    </div>
  )
}
