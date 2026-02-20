import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useConfigStore } from '@/stores/config-store'

function LoadingDots() {
  return (
    <div className='flex items-center gap-1'>
      <span>Loading</span>
      <span className='animate-[bounce_1s_ease-in-out_infinite]'>.</span>
      <span className='animate-[bounce_1s_ease-in-out_0.2s_infinite]'>.</span>
      <span className='animate-[bounce_1s_ease-in-out_0.4s_infinite]'>.</span>
    </div>
  )
}

export function LoaderPage() {
  const navigate = useNavigate()
  const status = useConfigStore((s) => s.status)
  const runSetup = useConfigStore((s) => s.runSetup)

  useEffect(() => {
    if (status === 'ready') {
      navigate('/projects', { replace: true })
    }
  }, [status, navigate])

  const handleSetup = async () => {
    await runSetup()
  }

  if (status === 'checking') {
    return (
      <Card className='w-full max-w-sm'>
        <CardContent className='pt-6'>
          <LoadingDots />
        </CardContent>
      </Card>
    )
  }

  if (status === 'setup') {
    return (
      <Card className='w-full max-w-sm'>
        <CardHeader>
          <CardTitle>Setup</CardTitle>
          <CardDescription>
            Create initial configuration and database scaffolding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSetup}>Setup</Button>
        </CardContent>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Card className='w-full max-w-sm'>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>
            Failed to initialize. Please restart the application.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className='w-full max-w-sm'>
      <CardContent className='pt-6'>
        <LoadingDots />
      </CardContent>
    </Card>
  )
}
