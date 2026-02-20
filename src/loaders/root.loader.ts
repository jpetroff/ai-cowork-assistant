import { redirect } from 'react-router-dom'
import { useConfigStore } from '@/stores/config-store'

export async function rootLoader() {
  const { status, isConfigured, initialize } = useConfigStore.getState()

  if (status === 'idle') {
    initialize()
  }

  if (isConfigured && status === 'ready') {
    return redirect('/projects')
  }

  return null
}
