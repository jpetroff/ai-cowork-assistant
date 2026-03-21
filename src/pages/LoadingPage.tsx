import { useAppStore } from '@/stores/appStore'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { CheckCircle, XCircle } from 'lucide-react'

export function LoadingPage() {
  const appPhase = useAppStore((s) => s.appPhase)
  const startupSteps = useAppStore((s) => s.startupSteps)
  const bootError = useAppStore((s) => s.bootError)
  const isFirstRun = useAppStore((s) => s.isFirstRun)
  const retry = useAppStore((s) => s.retry)

  const showSteps = !isFirstRun && startupSteps.length > 0

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-6 p-8">
      {/* App identity */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-2xl font-semibold tracking-tight">AI CoLab</div>
      </div>

      {/* Error state */}
      {appPhase === 'error' && bootError && (
        <div className="flex flex-col items-center gap-3 max-w-xs text-center">
          <XCircle className="size-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{bootError}</p>
          <Button size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      )}

      {/* Startup steps — delayed appearance so fast boots show nothing */}
      {showSteps && appPhase !== 'error' && (
        <ul
          className="flex flex-col gap-2 opacity-0 animate-[fadeIn_0.2s_ease_200ms_forwards]"
        >
          {startupSteps.map((step) => (
            <li key={step.id} className="flex items-center gap-2 text-sm">
              {step.status === 'loading' && (
                <Spinner className="size-4 shrink-0 text-muted-foreground" />
              )}
              {step.status === 'done' && (
                <CheckCircle className="size-4 shrink-0 text-muted-foreground" />
              )}
              {step.status === 'error' && (
                <XCircle className="size-4 shrink-0 text-destructive" />
              )}
              {step.status === 'pending' && (
                <span className="size-4 shrink-0 inline-block rounded-full border border-muted-foreground/40" />
              )}
              <span
                className={
                  step.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                }
              >
                {step.label}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Spinner for booting/loading when no steps yet */}
      {!showSteps && appPhase !== 'error' && (
        <Spinner className="size-6 text-muted-foreground" />
      )}
    </div>
  )
}
