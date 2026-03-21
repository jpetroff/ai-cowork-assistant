import { Skeleton } from '@/components/ui/skeleton'

export function MessageListSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-end">
        <Skeleton className="h-10 w-48 rounded-2xl" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-16 w-64 rounded-2xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-10 w-56 rounded-2xl" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-24 w-72 rounded-2xl" />
      </div>
    </div>
  )
}
