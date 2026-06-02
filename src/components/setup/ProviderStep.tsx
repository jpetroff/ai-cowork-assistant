import { useState } from 'react'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { createLlmProvider } from '@/lib/db/repositories'
import {
  PROVIDER_DEFAULT_BASE_URLS,
  PROVIDER_DEFAULT_CONFIGS,
  PROVIDER_LABELS,
  createProviderModelListRequest,
  type ProviderType,
  stringifyProviderConfig,
} from '@/components/settings/providerConfig'

interface ProviderStepProps {
  onComplete: () => void
}

export function ProviderStep({ onComplete }: ProviderStepProps) {
  const [providerType, setProviderType] = useState<ProviderType>('ollama')
  const [baseUrl, setBaseUrl] = useState(PROVIDER_DEFAULT_BASE_URLS.ollama)
  const [apiKey, setApiKey] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [testStatus, setTestStatus] = useState<
    'idle' | 'loading' | 'ok' | 'error'
  >('idle')
  const [testError, setTestError] = useState('')
  const [saving, setSaving] = useState(false)

  function handleTypeChange(type: ProviderType) {
    setProviderType(type)
    setBaseUrl(PROVIDER_DEFAULT_BASE_URLS[type])
    setApiKey('')
    setDefaultModel('')
    setTestStatus('idle')
    setTestError('')
  }

  async function handleTest() {
    if (!baseUrl.trim()) return
    setTestStatus('loading')
    setTestError('')
    try {
      const request = createProviderModelListRequest(
        providerType,
        baseUrl,
        apiKey
      )
      const res = await tauriFetch(request.url, {
        method: 'GET',
        headers: request.headers,
        connectTimeout: 5_000,
      })

      if (res.ok) {
        setTestStatus('ok')
      } else {
        setTestStatus('error')
        setTestError(`Server returned ${res.status}`)
      }
    } catch (err) {
      setTestStatus('error')
      setTestError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  async function handleSubmit() {
    if (!baseUrl.trim()) return
    setSaving(true)
    try {
      await createLlmProvider({
        name: PROVIDER_LABELS[providerType],
        provider_type: providerType,
        base_url: baseUrl.trim(),
        api_key: apiKey.trim() || undefined,
        default_model: defaultModel.trim() || null,
        config_json: stringifyProviderConfig(
          PROVIDER_DEFAULT_CONFIGS[providerType]
        ),
        is_default: 1,
      })
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  const canContinue = baseUrl.trim().length > 0 && !saving

  return (
    <div className='flex flex-col gap-5'>
      <div className='text-center space-y-1'>
        <h2 className='text-lg font-semibold'>Connect an AI provider</h2>
        <p className='text-sm text-muted-foreground'>
          You can add more providers later in Settings.
        </p>
      </div>

      {/* Provider type selector */}
      <div className='space-y-2'>
        <Label>Provider type</Label>
        <div className='flex gap-2 flex-wrap'>
          {(Object.keys(PROVIDER_LABELS) as ProviderType[]).map((type) => (
            <Button
              key={type}
              type='button'
              variant={providerType === type ? 'secondary' : 'outline'}
              size='sm'
              onClick={() => handleTypeChange(type)}
            >
              {PROVIDER_LABELS[type]}
            </Button>
          ))}
        </div>
      </div>

      {/* Base URL */}
      <div className='space-y-2'>
        <Label htmlFor='provider-url'>Base URL</Label>
        <Input
          id='provider-url'
          value={baseUrl}
          onChange={(e) => {
            setBaseUrl(e.target.value)
            setTestStatus('idle')
          }}
          placeholder='http://localhost:11434'
        />
      </div>

      {/* API Key (hidden for ollama) */}
      {providerType !== 'ollama' && (
        <div className='space-y-2'>
          <Label htmlFor='provider-key'>API Key</Label>
          <Input
            id='provider-key'
            type='password'
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setTestStatus('idle')
            }}
            placeholder='sk-…'
          />
        </div>
      )}

      <div className='space-y-2'>
        <Label htmlFor='provider-model'>Default model</Label>
        <Input
          id='provider-model'
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          placeholder='Model ID'
        />
      </div>

      {/* Test connection */}
      <div className='flex items-center gap-3'>
        <Button
          variant='outline'
          size='sm'
          onClick={handleTest}
          disabled={!baseUrl.trim() || testStatus === 'loading'}
        >
          {testStatus === 'loading' ? (
            <span className='flex items-center gap-2'>
              <Spinner className='w-3 h-3' /> Testing…
            </span>
          ) : (
            'Test connection'
          )}
        </Button>
        {testStatus === 'ok' && <Badge variant='default'>Connected</Badge>}
        {testStatus === 'error' && (
          <span className='text-sm text-destructive'>{testError}</span>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={!canContinue} className='w-full'>
        {saving ? 'Saving…' : 'Continue'}
      </Button>
    </div>
  )
}
