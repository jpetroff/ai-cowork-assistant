import { useConfigStore } from '@/stores/config-store'

export function ConfigDisplayPage() {
  const { user_name, user_avatar, model_name, model_api_url } = useConfigStore()

  return (
    <section className='space-y-2 p-4 text-sm'>
      <p>
        <strong>user_name:</strong> {user_name || '—'}
      </p>
      <p>
        <strong>user_avatar:</strong> {user_avatar || '—'}
      </p>
      <p>
        <strong>model_name:</strong> {model_name || '—'}
      </p>
      <p>
        <strong>model_api_url:</strong> {model_api_url || '—'}
      </p>
    </section>
  )
}
