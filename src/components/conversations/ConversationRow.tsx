import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DotsThreeIcon,
  PencilSimpleIcon,
  TrashIcon,
  CheckIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useConversationStore } from '@/components/conversations/conversationStore'
import { useBackgroundGenerationStore } from '@/components/chat/backgroundGenerationStore'
import type { Conversation } from '@/lib/db/types'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

interface ConversationRowProps {
  conversation: Conversation
  projectId: string
}

function formatRelativeTime(unixMs: number): string {
  const diff = Date.now() - unixMs
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export function ConversationRow({
  conversation,
  projectId,
}: ConversationRowProps) {
  const navigate = useNavigate()
  const rename = useConversationStore((s) => s.rename)
  const deleteConversation = useConversationStore((s) => s.delete)
  const operationState = useConversationStore(
    (s) => s.operationStates[conversation.id]
  )
  const hasBackgroundJob = useBackgroundGenerationStore(
    (s) => s.activeJobs[conversation.id] != null
  )

  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isDeleting = operationState === 'deleting'
  const isRenaming = operationState === 'renaming'
  const isBusy = isDeleting || isRenaming

  const displayTitle = conversation.title || 'Untitled'

  function handleClick() {
    if (isBusy || renaming) return
    navigate(`/projects/${projectId}/chats/${conversation.id}`)
  }

  function startRename() {
    setDraft(conversation.title || '')
    setRenaming(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function applyRename() {
    const trimmed = draft.trim()
    rename(conversation.id, trimmed || 'Untitled')
    setRenaming(false)
  }

  function discardRename() {
    setRenaming(false)
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      applyRename()
    }
    if (e.key === 'Escape') discardRename()
  }

  function handleDelete() {
    setDeleteOpen(false)
    deleteConversation(conversation.id)
  }

  return (
    <>
      <div
        role='button'
        tabIndex={isBusy ? -1 : 0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        className={cn(
          'group flex items-center gap-3 px-surface-card py-control-y-md rounded-card',
          'hover:bg-muted/50 transition-colors cursor-pointer select-none',
          isBusy && 'opacity-50 cursor-not-allowed pointer-events-none'
        )}
      >
        {/* Title / inline rename */}
        <div className='flex-1 min-w-0'>
          {renaming ? (
            <div
              className='flex items-center gap-1'
              onClick={(e) => e.stopPropagation()}
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                className='flex-1 bg-transparent border-b border-primary type-ui-md outline-none min-w-0'
                autoFocus
              />
              <Button
                variant='ghost'
                size='icon-sm'
                onClick={applyRename}
                aria-label='Apply'
              >
                {isRenaming ? (
                  <Spinner className='size-3' />
                ) : (
                  <CheckIcon className='size-3' />
                )}
              </Button>
              <Button
                variant='ghost'
                size='icon-sm'
                onClick={discardRename}
                aria-label='Discard'
              >
                <XIcon className='size-3' />
              </Button>
            </div>
          ) : (
            <p className='type-ui-md truncate'>{displayTitle}</p>
          )}
          <p className='type-ui-xs text-muted-foreground mt-1'>
            {formatRelativeTime(conversation.updated_at)}
          </p>
        </div>

        {/* Hover-reveal action menu */}
        {!renaming && (
          <span className='flex items-center gap-1'>
            {hasBackgroundJob && (
              <Spinner
                className='size-icon-sm text-muted-foreground'
                aria-label='Background job running'
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={isBusy}
                onClick={(e) => e.stopPropagation()}
                render={
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label='Chat options'
                    className='opacity-0 group-hover:opacity-100 transition-opacity'
                    onClick={(e) => e.stopPropagation()}
                  />
                }
              >
                <DotsThreeIcon weight='bold' />
              </DropdownMenuTrigger>
              <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    startRename()
                  }}
                >
                  <PencilSimpleIcon />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className='text-destructive focus:text-destructive'
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteOpen(true)
                  }}
                >
                  <TrashIcon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              "{displayTitle}" and all its messages will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
