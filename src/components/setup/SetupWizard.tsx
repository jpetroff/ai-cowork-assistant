import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { useAppStore } from '@/app/appStore'
import { WizardStepper } from './WizardStepper'
import { ProfileStep } from './ProfileStep'
import { ProviderStep } from './ProviderStep'
import { DoneStep } from './DoneStep'

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const setupDefaults = useAppStore((s) => s.setupDefaults)
  const onSetupComplete = useAppStore((s) => s.onSetupComplete)

  function handleProfileDone() {
    setCurrentStep(2)
  }

  function handleProviderDone() {
    setCurrentStep(3)
    onSetupComplete()
  }

  return (
    <div className='flex flex-col items-center justify-center h-full p-8 gap-4'>
      <Card className='w-full max-w-md p-6 space-y-6'>
        <WizardStepper currentStep={currentStep} />

        <div className='pt-2'>
          {currentStep === 1 && (
            <ProfileStep
              defaultName={setupDefaults?.name ?? ''}
              avatarPath={setupDefaults?.avatarPath ?? null}
              onComplete={handleProfileDone}
            />
          )}
          {currentStep === 2 && (
            <ProviderStep onComplete={handleProviderDone} />
          )}
          {currentStep === 3 && <DoneStep />}
        </div>
      </Card>
    </div>
  )
}
