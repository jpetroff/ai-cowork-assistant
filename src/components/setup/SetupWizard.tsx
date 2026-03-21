import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Card } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/appStore'
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
    <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <WizardStepper currentStep={currentStep} />

        <div className="pt-2">
          {currentStep === 1 && (
            <ProfileStep
              defaultName={setupDefaults?.name ?? ''}
              avatarPath={setupDefaults?.avatarPath ?? null}
              onComplete={handleProfileDone}
            />
          )}
          {currentStep === 2 && <ProviderStep onComplete={handleProviderDone} />}
          {currentStep === 3 && <DoneStep />}
        </div>
      </Card>

      {/* Dev-only reset button */}
      {import.meta.env.DEV && <DevResetButton />}
    </div>
  )
}

function DevResetButton() {
  async function handleReset() {
    await invoke('clear_app_data')
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        className="text-muted-foreground/50 text-xs px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
      >
        Reset App Data
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset all app data?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the local database and all stored data. The app will
            restart. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete & Restart
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
