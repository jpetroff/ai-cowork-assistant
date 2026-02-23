import { Loader2 } from 'lucide-react'

export function ProgressEvent({ event }: { event: string }) {
  return (
    <div className='flex items-center gap-2 text-xs text-muted-foreground animate-pulse py-1'>
      <Loader2 className='size-3 animate-spin' />
      <span>{event}</span>
    </div>
  )
}
