export function ProgressEvent({ event }: { event: string }) {
  return <span className='text-xs text-muted-foreground'>{event}</span>
}