import { cn } from '@/lib/utils'

const STEPS = ['Profile', 'LLM Provider', 'Done'] as const

interface WizardStepperProps {
  currentStep: 1 | 2 | 3
}

export function WizardStepper({ currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-center gap-0 w-full">
      {STEPS.map((label, idx) => {
        const stepNum = (idx + 1) as 1 | 2 | 3
        const isDone = stepNum < currentStep
        const isActive = stepNum === currentStep

        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors',
                  isDone && 'bg-primary border-primary text-primary-foreground',
                  isActive && 'border-primary text-primary bg-transparent',
                  !isDone && !isActive && 'border-muted-foreground/30 text-muted-foreground/50',
                )}
              >
                {isDone ? '✓' : stepNum}
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium whitespace-nowrap',
                  isActive && 'text-foreground',
                  !isActive && 'text-muted-foreground/60',
                )}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-px mx-2 mb-5 transition-colors',
                  stepNum < currentStep ? 'bg-primary' : 'bg-muted-foreground/20',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
