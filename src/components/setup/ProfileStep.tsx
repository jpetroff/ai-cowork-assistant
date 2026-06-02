import { ProfileForm } from './ProfileForm'

interface ProfileStepProps {
  defaultName: string
  avatarPath: string | null
  onComplete: () => void
}

export function ProfileStep({
  defaultName,
  avatarPath,
  onComplete,
}: ProfileStepProps) {
  return (
    <ProfileForm
      defaultName={defaultName}
      avatarPath={avatarPath}
      title="Welcome! What's your name?"
      description='This is how the AI will address you.'
      submitLabel='Continue'
      onComplete={onComplete}
    />
  )
}
