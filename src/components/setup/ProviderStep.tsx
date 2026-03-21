import { useState } from 'react'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { createLlmProvider } from '@/lib/db/repositories'

type ProviderType = 'ollama' | 'openai' | 'custom'

const PROVIDER_LABELS: Record<ProviderType, string> = {
  ollama: 'Ollama (local)',
  openai: 'OpenAI',
  custom: 'Custom (OpenAI-compatible)',
}

const PROVIDER_DEFAULTS: Record<ProviderType, string> = {
  ollama: 'http://localhost:11434',
  openai: 'https://api.openai.com/v1',
  custom: '',
}

interface ProviderStepProps {
  onComplete: () => void
}

export function ProviderStep({ onComplete }: ProviderStepProps) {
  const [providerType, setProviderType] = useState<ProviderType>('ollama')
  const [baseUrl, setBaseUrl] = useState(PROVIDER_DEFAULTS.ollama)
  const [apiKey, setApiKey] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [testError, setTestError] = useState('')
  const [saving, setSaving] = useState(false)

  function handleTypeChange(type: ProviderType) {
    setProviderType(type)
    setBaseUrl(PROVIDER_DEFAULTS[type])
    setApiKey('')
    setTestStatus('idle')
    setTestError('')
  }

  async function handleTest() {
    if (!baseUrl.trim()) return
    setTestStatus('loading')
    setTestError('')
    try {
      const url = baseUrl.replace(/\/$/, '') + '/models'
      const headers: Record<string, string> = {}
      if (apiKey.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5_000)
      const res = await tauriFetch(url, { method: 'GET', headers })
      clearTimeout(timeout)

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
        is_default: 1,
      })
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  const canContinue = baseUrl.trim().length > 0 && !saving

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold">Connect an AI provider</h2>
        <p className="text-sm text-muted-foreground">
          You can add more providers later in Settings.
        </p>
      </div>

      {/* Provider type selector */}
      <div className="space-y-2">
        <Label>Provider type</Label>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PROVIDER_LABELS) as ProviderType[]).map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                providerType === type
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-muted-foreground'
              }`}
            >
              {PROVIDER_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Base URL */}
      <div className="space-y-2">
        <Label htmlFor="provider-url">Base URL</Label>
        <Input
          id="provider-url"
          value={baseUrl}
          onChange={(e) => {
            setBaseUrl(e.target.value)
            setTestStatus('idle')
          }}
          placeholder="http://localhost:11434"
        />
      </div>

      {/* API Key (hidden for ollama) */}
      {providerType !== 'ollama' && (
        <div className="space-y-2">
          <Label htmlFor="provider-key">API Key</Label>
          <Input
            id="provider-key"
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setTestStatus('idle')
            }}
            placeholder="sk-…"
          />
        </div>
      )}

      {/* Test connection */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={!baseUrl.trim() || testStatus === 'loading'}
        >
          {testStatus === 'loading' ? (
            <span className="flex items-center gap-2">
              <Spinner className="w-3 h-3" /> Testing…
            </span>
          ) : (
            'Test connection'
          )}
        </Button>
        {testStatus === 'ok' && <Badge variant="default" className="bg-green-600">Connected</Badge>}
        {testStatus === 'error' && (
          <span className="text-sm text-destructive">{testError}</span>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={!canContinue} className="w-full">
        {saving ? 'Saving…' : 'Continue'}
      </Button>
    </div>
  )
}
