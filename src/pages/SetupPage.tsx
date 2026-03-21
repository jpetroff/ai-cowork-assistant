import { Card } from '@/components/ui/card'

export function SetupPage() {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-semibold mb-4">First-run setup</h1>
        <div className="space-y-4">{/* form area */}</div>
      </Card>
    </div>
  )
}
