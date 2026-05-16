import { Spinner } from '@/components/ui/spinner'
import { useAppStore } from '@/app/appStore'

export function DoneStep() {
  const sidcarStatus = useAppStore((s) => s.sidcarStatus)
  const isReady = sidcarStatus === 'ready'

  return (
    <div className='flex flex-col items-center gap-6 py-4 text-center'>
      <div className='w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center'>
        {isReady ? (
          <span className='text-2xl'>✓</span>
        ) : (
          <Spinner className='w-6 h-6 text-primary' />
        )}
      </div>

      <div className='space-y-1'>
        <h2 className='text-lg font-semibold'>
          {isReady ? 'All set!' : 'Almost ready…'}
        </h2>
        <p className='text-sm text-muted-foreground'>
          {isReady
            ? 'Taking you to the app now.'
            : 'Starting the AI engine in the background.'}
        </p>
      </div>
    </div>
  )
}
