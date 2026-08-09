import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon, BotIcon, SearchIcon, UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PersonalSettingsSection } from '@/components/settings/PersonalSettingsSection'
import { ProvidersSettingsSection } from '@/components/settings/ProvidersSettingsSection'
import { WebResearchSettingsSection } from '@/components/settings/WebResearchSettingsSection'

type SettingsSection = 'personal' | 'providers' | 'web-research'

const sections: Array<{
  id: SettingsSection
  label: string
  icon: typeof UserIcon
}> = [
  { id: 'personal', label: 'Personal', icon: UserIcon },
  { id: 'providers', label: 'Providers', icon: BotIcon },
  { id: 'web-research', label: 'Web Research', icon: SearchIcon },
]

export function SettingsPage() {
  const [section, setSection] = useState<SettingsSection>('personal')

  return (
    <main className='flex h-full min-h-0 flex-col overflow-hidden'>
      <header className='flex items-center gap-3 border-b px-page-x py-surface-card'>
        <Link
          to='/'
          className='flex h-control-sm shrink-0 items-center gap-1.5 rounded-control px-2 type-ui-sm text-muted-foreground transition-colors hover:text-foreground'
        >
          <ArrowLeftIcon className='size-icon-sm' />
          Projects
        </Link>
        <span className='type-ui-sm text-muted-foreground'>/</span>
        <h1 className='type-title-sm font-medium'>Settings</h1>
      </header>

      <div className='grid min-h-0 flex-1 grid-cols-[14rem_minmax(0,1fr)] overflow-hidden'>
        <aside className='border-r p-surface-card'>
          <nav className='flex flex-col gap-1'>
            {sections.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  type='button'
                  variant={section === item.id ? 'secondary' : 'ghost'}
                  size='sm'
                  className='justify-start'
                  onClick={() => setSection(item.id)}
                >
                  <Icon className='size-icon-sm' />
                  {item.label}
                </Button>
              )
            })}
          </nav>
        </aside>

        <section className='min-w-0 overflow-y-auto px-page-x py-page-y'>
          {section === 'personal' && <PersonalSettingsSection />}
          {section === 'providers' && <ProvidersSettingsSection />}
          {section === 'web-research' && <WebResearchSettingsSection />}
        </section>
      </div>
    </main>
  )
}
