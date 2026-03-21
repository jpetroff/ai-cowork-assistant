import { Card } from '@/components/ui/card'
import { useAppStore } from '@/stores/appStore'

export function SetupPage() {
  const onSetupComplete = useAppStore((s) => s.onSetupComplete)

  return (
    <div className="flex items-center justify-center h-full p-8">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-semibold mb-4">First-run setup</h1>
        <div className="space-y-4">
          {/* LLM provider form — calls onSetupComplete() on submit */}
        </div>
      </Card>
    </div>
  )
}
