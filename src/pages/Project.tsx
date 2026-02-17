import { useEffect, useRef, useState } from 'react'
import { useConfigStore } from '@/stores/config-store'
import { useProjectStore } from '@/stores/project-store'
import { ProjectEditor } from '@/components/ProjectEditor'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'

const MOCK_MESSAGES = [
  {
    id: '1',
    role: 'user' as const,
    content: 'Help me draft a short requirements doc.',
    createdAt: Date.now() - 60000,
  },
  {
    id: '2',
    role: 'assistant' as const,
    content: 'I’ll help. Share the project name and main goals.',
    createdAt: Date.now() - 30000,
  },
]

function ChatSidebar() {
  const { user_name, user_avatar, model_name } = useConfigStore()

  return (
    <aside className='hidden md:flex md:w-[320px] flex-col border-r border-border bg-background'>
      <Card
        size='sm'
        className='rounded-none border-0 border-b border-border shadow-none'
      >
        <CardHeader className='pb-3'>
          <div className='flex items-center gap-2'>
            <Avatar size='sm' className='size-8'>
              {user_avatar ? (
                <AvatarImage src={user_avatar} alt={user_name || 'User'} />
              ) : null}
              <AvatarFallback className='text-xs'>
                {(user_name || 'U').slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium text-foreground'>
                {user_name || 'You'}
              </p>
              <Badge variant='secondary' className='text-[10px] font-normal'>
                {model_name || 'Model'}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>
      <ScrollArea className='flex-1'>
        <div className='flex flex-col gap-2 p-3'>
          {MOCK_MESSAGES.map((msg) => (
            <div
              key={msg.id}
              className='rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground'
            >
              <p className='font-medium text-muted-foreground text-xs'>
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </p>
              <p className='mt-0.5'>{msg.content}</p>
              <p className='mt-1 text-[10px] text-muted-foreground'>
                {formatDistanceToNow(msg.createdAt, { addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className='border-t border-border p-3'>
        <Input
          disabled
          placeholder='Chat coming soon'
          className='text-sm'
          aria-label='Chat input'
        />
      </div>
    </aside>
  )
}

function SaveStatus({
  lastSavedAt,
  isLoading,
}: {
  lastSavedAt?: number
  isLoading: boolean
}) {
  if (isLoading)
    return <span className='text-muted-foreground text-xs'>Saving…</span>
  if (lastSavedAt == null)
    return <span className='text-muted-foreground text-xs'>Unsaved</span>
  return (
    <span className='text-muted-foreground text-xs'>
      Saved {formatDistanceToNow(lastSavedAt, { addSuffix: true })}
    </span>
  )
}

export function Project() {
  const loadArtifact = useProjectStore((s) => s.loadArtifact)
  const markdown = useProjectStore((s) => s.markdown)
  const isStreaming = useProjectStore((s) => s.isStreaming)
  const setMarkdown = useProjectStore((s) => s.setMarkdown)
  const setName = useProjectStore((s) => s.setName)
  const saveCurrent = useProjectStore((s) => s.saveCurrent)
  const name = useProjectStore((s) => s.name)
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt)
  const isLoading = useProjectStore((s) => s.isLoading)
  const loadedOnce = useProjectStore((s) => s.loadedOnce)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(name)
  const DEBOUNCE_MS = 800

  useEffect(() => {
    loadArtifact()
  }, [loadArtifact])

  useEffect(() => {
    setTitleValue(name)
  }, [name])

  useEffect(() => {
    if (!loadedOnce || isStreaming) return
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveCurrent()
      saveTimeoutRef.current = null
    }, DEBOUNCE_MS)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [markdown, isStreaming, saveCurrent, loadedOnce])

  useEffect(() => {
    if (!loadedOnce) return
    if (nameTimeoutRef.current) {
      clearTimeout(nameTimeoutRef.current)
      nameTimeoutRef.current = null
    }
    nameTimeoutRef.current = setTimeout(() => {
      setName(titleValue)
      saveCurrent()
      nameTimeoutRef.current = null
    }, DEBOUNCE_MS)
    return () => {
      if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current)
    }
  }, [titleValue, loadedOnce, setName, saveCurrent])

  const handleTitleBlur = () => {
    setIsEditingTitle(false)
    setName(titleValue)
    saveCurrent()
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      setTitleValue(name)
      setIsEditingTitle(false)
    }
  }

  return (
    <div className='flex h-screen max-h-screen w-full bg-background'>
      <ChatSidebar />
      <div className='flex flex-1 flex-col min-w-0'>
        <header className='flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2'>
          {isEditingTitle ? (
            <Input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={handleTitleKeyDown}
              className='text-sm font-medium h-auto px-2 py-1'
              autoFocus
            />
          ) : (
            <h1
              className='truncate text-sm font-medium text-foreground cursor-text hover:text-primary transition-colors'
              onClick={() => setIsEditingTitle(true)}
              title='Click to edit title'
            >
              {name || 'Untitled project'}
            </h1>
          )}
          <SaveStatus lastSavedAt={lastSavedAt} isLoading={isLoading} />
        </header>
        <div className='flex-1 min-h-0 overflow-hidden p-4'>
          <ProjectEditor
            value={markdown}
            onChange={setMarkdown}
            isStreaming={isStreaming}
            className='h-full min-h-0'
          />
        </div>
      </div>
    </div>
  )
}
