import { useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setSetting } from '@/lib/db/settings'

interface ProfileStepProps {
  defaultName: string
  avatarPath: string | null
  onComplete: () => void
}

export function ProfileStep({ defaultName, avatarPath, onComplete }: ProfileStepProps) {
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const initials = name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .slice(0, 2)
        .join('')
    : '?'

  const avatarSrc = avatarPath ? convertFileSrc(avatarPath) : null

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setError('')
    setSaving(true)
    try {
      await setSetting('user_profile', JSON.stringify({ name: name.trim(), avatarPath }))
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold">Welcome! What's your name?</h2>
        <p className="text-sm text-muted-foreground">
          This is how the AI will address you.
        </p>
      </div>

      {/* Avatar preview */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-border flex items-center justify-center bg-muted select-none">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="Your avatar"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide broken image, initials will show via sibling
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <span className="text-2xl font-semibold text-muted-foreground">{initials}</span>
          )}
        </div>
      </div>

      {/* Name input */}
      <div className="space-y-2">
        <Label htmlFor="profile-name">Your name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Your name"
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <Button onClick={handleSubmit} disabled={saving} className="w-full">
        {saving ? 'Saving…' : 'Continue'}
      </Button>
    </div>
  )
}
