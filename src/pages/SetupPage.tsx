import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useConfigStore } from '@/stores/config-store'
import { saveConfiguration, CONFIG_KEYS } from '@/lib/db'

export function SetupPage() {
  const navigate = useNavigate()
  const setFromConfig = useConfigStore((s) => s.setFromConfig)

  const runSetup = useCallback(async () => {
    const info = await invoke<{ username: string; avatar_path: string }>(
      'get_system_user_info'
    )
    await saveConfiguration({
      [CONFIG_KEYS.USER_NAME]: info.username,
      [CONFIG_KEYS.USER_AVATAR]: info.avatar_path,
      [CONFIG_KEYS.MODEL_NAME]: 'gpt-oss-20b',
      [CONFIG_KEYS.MODEL_API_URL]: 'https://llama.intranet/v1',
    })
    const config = await import('@/lib/db').then((m) => m.loadConfiguration())
    setFromConfig(config)
    navigate('/app')
  }, [navigate, setFromConfig])

  return (
    <Card className='w-full max-w-sm'>
      <CardHeader>
        <CardTitle>Setup</CardTitle>
        <CardDescription>
          Create initial configuration and database scaffolding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={runSetup}>Setup</Button>
      </CardContent>
    </Card>
  )
}
