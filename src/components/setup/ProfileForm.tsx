import { useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setSetting } from '@/lib/db/settings'

interface ProfileFormProps {
  avatarPath: string | null
  defaultName: string
  submitLabel: string
  title?: string
  description?: string
  onComplete: () => void
}

export function ProfileForm({
  avatarPath,
  defaultName,
  submitLabel,
  title,
  description,
  onComplete,
}: ProfileFormProps) {
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(defaultName)
  }, [defaultName])

  const initials = name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .map((word) => word[0]?.toUpperCase() ?? '')
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
      await setSetting(
        'user_profile',
        JSON.stringify({ name: name.trim(), avatarPath })
      )
      onComplete()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className='flex flex-col gap-6'
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit()
      }}
    >
      {(title || description) && (
        <header className='space-y-1 text-center'>
          {title && <h2 className='text-lg font-semibold'>{title}</h2>}
          {description && (
            <p className='text-sm text-muted-foreground'>{description}</p>
          )}
        </header>
      )}

      <div className='flex justify-center'>
        <div className='flex h-20 w-20 select-none items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-border'>
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt='Your avatar'
              className='h-full w-full object-cover'
              onError={(event) => {
                ;(event.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <span className='text-2xl font-semibold text-muted-foreground'>
              {initials}
            </span>
          )}
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='profile-name'>Your name</Label>
        <Input
          id='profile-name'
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (error) setError('')
          }}
          placeholder='Your name'
          autoFocus
        />
        {error && <p className='text-sm text-destructive'>{error}</p>}
      </div>

      <Button type='submit' disabled={saving} className='w-full'>
        {saving ? 'Saving...' : submitLabel}
      </Button>
    </form>
  )
}
