import { Spinner } from '@/components/ui/spinner'

export function LoadingPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen gap-3">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Starting up…</p>
    </div>
  )
}
