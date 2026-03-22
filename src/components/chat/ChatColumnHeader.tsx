import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, MoreVertical, Trash2, Pencil } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useConversationStore } from '@/stores/conversationStore'
import { cn } from '@/lib/utils'

interface ChatColumnHeaderProps {
  projectId: string
}

export function ChatColumnHeader({ projectId }: ChatColumnHeaderProps) {
  const navigate = useNavigate()
  const { activeConversationId, conversations, rename, delete: deleteConversation } = useConversationStore()
  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleRenameOpen = () => {
    setRenameValue(activeConversation?.title ?? '')
    setIsRenaming(true)
  }

  const handleRenameSubmit = async () => {
    if (!activeConversationId) return
    const title = renameValue.trim()
    if (title) {
      await rename(activeConversationId, title)
    }
    setIsRenaming(false)
  }

  const handleDelete = async () => {
    if (!activeConversationId) return
    await deleteConversation(activeConversationId)
    navigate(`/projects/${projectId}`)
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0">
      <Link
        to={`/projects/${projectId}`}
        aria-label="Back to project"
        className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
      >
        <ChevronLeft className="size-4" />
      </Link>

      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleRenameSubmit() }
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            className="h-7 text-sm"
          />
        ) : (
          <p className="text-sm font-medium truncate">
            {activeConversation?.title ?? 'Untitled conversation'}
          </p>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
          aria-label="Conversation options"
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleRenameOpen}>
            <Pencil className="size-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
