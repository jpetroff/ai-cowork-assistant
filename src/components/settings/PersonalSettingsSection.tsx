import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from '@/components/setup/ProfileForm'
import { getSetting } from '@/lib/db/settings'

interface UserProfile {
  name: string
  avatarPath: string | null
}

function parseProfile(raw: string | null): UserProfile {
  if (!raw) return { name: '', avatarPath: null }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      avatarPath:
        typeof parsed.avatarPath === 'string' ? parsed.avatarPath : null,
    }
  } catch {
    return { name: '', avatarPath: null }
  }
}

export function PersonalSettingsSection() {
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    avatarPath: null,
  })
  const [saveCount, setSaveCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    getSetting('user_profile').then((raw) => {
      if (!cancelled) setProfile(parseProfile(raw))
    })
    return () => {
      cancelled = true
    }
  }, [saveCount])

  return (
    <Card className='max-w-xl'>
      <CardHeader>
        <CardTitle>Personal</CardTitle>
      </CardHeader>
      <CardContent>
        <ProfileForm
          defaultName={profile.name}
          avatarPath={profile.avatarPath}
          submitLabel='Save profile'
          onComplete={() => setSaveCount((count) => count + 1)}
        />
      </CardContent>
    </Card>
  )
}
