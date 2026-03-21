import { Skeleton } from '@/components/ui/skeleton'

export function EditorSkeleton() {
  return (
    <div className="h-full w-full p-4">
      <Skeleton className="h-full w-full rounded-md" />
    </div>
  )
}
