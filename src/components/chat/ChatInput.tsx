import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, FileText, Plus, Send, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useChatSessionStore } from '@/components/chat/chatSessionStore'
import { useArtifactStore } from '@/components/editor/artifactStore'
import {
  listArtifacts,
  listArtifactsByProject,
} from '@/lib/db/repositories/documents'
import type { Artifact } from '@/lib/db/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type ArtifactContextSource = 'conversation' | 'project'

type ArtifactContextState =
  | { mode: 'auto' }
  | { mode: 'none' }
  | { mode: 'artifact'; artifactId: string; title: string | null }

interface VisibleArtifactContext {
  artifactId: string
  title: string | null
  sourceLabel: string
}

function getArtifactTitle(title: string | null): string {
  return title?.trim() || 'Untitled'
}

function sortArtifactsByUpdatedAt(artifacts: Artifact[]): Artifact[] {
  return [...artifacts].sort((a, b) => b.updated_at - a.updated_at)
}

export function ChatInput() {
  const [value, setValue] = useState('')
  const [contextState, setContextState] = useState<ArtifactContextState>({
    mode: 'auto',
  })
  const [artifactSource, setArtifactSource] =
    useState<ArtifactContextSource>('conversation')
  const [artifactItems, setArtifactItems] = useState<Artifact[]>([])
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false)
  const [artifactError, setArtifactError] = useState<string | null>(null)
  const isStreaming = useChatSessionStore((s) => s.isAssistantStreaming)
  const submitMessage = useChatSessionStore((s) => s.submitMessage)
  const activeConversationId = useChatSessionStore(
    (s) => s.activeConversationId
  )
  const activeProjectId = useChatSessionStore((s) => s.activeProjectId)
  const activeArtifact = useArtifactStore((s) => s.artifact)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSubmit = value.trim().length > 0 && !isStreaming
  const visibleContext: VisibleArtifactContext | null =
    contextState.mode === 'auto'
      ? activeArtifact
        ? {
            artifactId: activeArtifact.id,
            title: activeArtifact.title,
            sourceLabel: 'Editor',
          }
        : null
      : contextState.mode === 'artifact'
        ? {
            artifactId: contextState.artifactId,
            title: contextState.title,
            sourceLabel: 'Selected',
          }
        : null
  const selectedArtifactId =
    visibleContext?.artifactId ?? activeArtifact?.id ?? null
  const canOpenArtifactMenu =
    !isStreaming && (activeConversationId !== null || activeProjectId !== null)

  const loadArtifactItems = useCallback(async () => {
    if (artifactSource === 'conversation' && !activeConversationId) {
      setArtifactItems([])
      setArtifactError(null)
      return
    }
    if (artifactSource === 'project' && !activeProjectId) {
      setArtifactItems([])
      setArtifactError(null)
      return
    }

    setIsLoadingArtifacts(true)
    setArtifactError(null)
    try {
      const artifacts =
        artifactSource === 'conversation'
          ? await listArtifacts(activeConversationId!)
          : await listArtifactsByProject(activeProjectId!)
      setArtifactItems(sortArtifactsByUpdatedAt(artifacts))
    } catch (err) {
      setArtifactError(
        err instanceof Error ? err.message : 'Failed to load artifacts'
      )
    } finally {
      setIsLoadingArtifacts(false)
    }
  }, [activeConversationId, activeProjectId, artifactSource])

  useEffect(() => {
    void loadArtifactItems()
  }, [loadArtifactItems, activeArtifact?.id, activeArtifact?.updated_at])

  const handleSubmit = async () => {
    const content = value.trim()
    if (!content || isStreaming) return
    setValue('')

    await submitMessage(
      content,
      contextState.mode === 'auto'
        ? undefined
        : contextState.mode === 'artifact'
          ? { artifactId: contextState.artifactId }
          : null
    )

    setContextState({ mode: 'auto' })

    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className='border-t p-surface-card shrink-0 space-y-2'>
      <div className='flex min-h-control-sm items-center'>
        {visibleContext ? (
          <div className='flex max-w-full items-center gap-2 rounded-control border bg-muted px-control-x-sm py-control-y-sm text-muted-foreground'>
            <FileText className='size-icon-sm shrink-0' />
            <span className='min-w-0 type-ui-sm text-foreground'>
              <span className='block truncate'>
                {getArtifactTitle(visibleContext.title)}
              </span>
            </span>
            <span className='type-ui-xs text-muted-foreground'>
              {visibleContext.sourceLabel}
            </span>
            <Button
              type='button'
              variant='ghost'
              size='icon-xs'
              onClick={() => setContextState({ mode: 'none' })}
              disabled={isStreaming}
              aria-label='Remove artifact context'
            >
              <X className='size-icon-sm' />
            </Button>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={!canOpenArtifactMenu}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'icon-sm' })
              )}
              aria-label='Add artifact context'
              title='Add artifact context'
            >
              <Plus className='size-icon-sm' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-80'>
              <DropdownMenuLabel>Artifact context</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={artifactSource}
                onValueChange={(value) =>
                  setArtifactSource(value as ArtifactContextSource)
                }
              >
                <DropdownMenuRadioItem
                  value='conversation'
                  disabled={!activeConversationId}
                >
                  This conversation
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem
                  value='project'
                  disabled={!activeProjectId}
                >
                  Project artifacts
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              {isLoadingArtifacts && (
                <DropdownMenuItem disabled className='text-muted-foreground'>
                  Loading artifacts
                </DropdownMenuItem>
              )}
              {artifactError && (
                <DropdownMenuItem disabled className='text-destructive'>
                  {artifactError}
                </DropdownMenuItem>
              )}
              {!isLoadingArtifacts &&
                !artifactError &&
                artifactItems.length === 0 && (
                  <DropdownMenuItem disabled className='text-muted-foreground'>
                    No artifacts
                  </DropdownMenuItem>
                )}
              {!isLoadingArtifacts &&
                !artifactError &&
                artifactItems.map((artifact) => {
                  const isSelected = artifact.id === selectedArtifactId

                  return (
                    <DropdownMenuItem
                      key={artifact.id}
                      onClick={() =>
                        setContextState({
                          mode: 'artifact',
                          artifactId: artifact.id,
                          title: artifact.title,
                        })
                      }
                      className={cn(
                        'cursor-pointer justify-between',
                        isSelected && 'bg-accent'
                      )}
                    >
                      <span className='flex min-w-0 items-center gap-2'>
                        <FileText className='size-icon-sm text-muted-foreground' />
                        <span className='truncate'>
                          {getArtifactTitle(artifact.title)}
                        </span>
                      </span>
                      {isSelected && <Check className='size-icon-sm' />}
                    </DropdownMenuItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className='flex gap-3 items-end'>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming ? 'Assistant is writing…' : 'Message… (⌘↵ to send)'
          }
          disabled={isStreaming}
          rows={3}
          className='resize-none flex-1 type-ui-md'
        />
        <Button
          size='icon'
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label='Send message'
        >
          <Send className='size-4' />
        </Button>
      </div>
    </div>
  )
}
