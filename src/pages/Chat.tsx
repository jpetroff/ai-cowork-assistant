import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useConfigStore } from '@/stores/config-store'
import { useChatStore } from '@/stores/chat-store'
import { useChatsStore } from '@/stores/chats-store'
import * as chatsApi from '@/lib/chats'
import { ProjectEditor } from '@/components/ProjectEditor'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDistanceToNow } from 'date-fns'
import { ChatMessage, ChatInput } from '@/components/chat'
import {
  getChatController,
  resetChatController,
} from '@/lib/chat/chat-controller'
import { MoreVertical, Trash2, FolderInput } from 'lucide-react'

const CHAT_MIN_WIDTH = 280
const RESIZE_HANDLE_WIDTH = 4

function useResizablePanel(
  initialWidth: number,
  minWidth: number,
  maxWidthPercent: number
) {
  const [width, setWidth] = useState(initialWidth)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return
      const container = containerRef.current.parentElement
      if (!container) return
      const containerRect = container.getBoundingClientRect()
      const newWidth = e.clientX - containerRect.left
      const maxWidth = containerRect.width * maxWidthPercent
      const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth))
      setWidth(clampedWidth)
    },
    [isDragging, minWidth, maxWidthPercent]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return { width, isDragging, handleMouseDown, containerRef }
}

function ChatSidebar({
  width,
  resizeHandle,
}: {
  width: number
  resizeHandle: React.ReactNode
}) {
  const { user_name, user_avatar, model_name } = useConfigStore()
  const messages = useChatStore((s) => s.messages)

  return (
    <aside
      className='relative flex flex-col border-r border-border bg-background shrink-0'
      style={{ width: `${width}px` }}
    >
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
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </div>
      </ScrollArea>
      <div className='border-t border-border p-3'>
        <ChatInput />
      </div>
      {resizeHandle}
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

export function Chat() {
  const { projectId, chatId } = useParams<{
    projectId: string
    chatId: string
  }>()
  const navigate = useNavigate()
  const loadChat = useChatStore((s) => s.loadChat)
  const markdown = useChatStore((s) => s.markdown)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const setMarkdown = useChatStore((s) => s.setMarkdown)
  const setName = useChatStore((s) => s.setName)
  const saveCurrent = useChatStore((s) => s.saveCurrent)
  const artifactName = useChatStore((s) => s.artifactName)
  const name = useChatStore((s) => s.name)
  const lastSavedAt = useChatStore((s) => s.lastSavedAt)
  const isLoading = useChatStore((s) => s.isLoading)
  const loadedOnce = useChatStore((s) => s.loadedOnce)
  const setConnectionStatus = useChatStore((s) => s.setConnectionStatus)
  const sidecarUrl = useConfigStore((s) => s.sidecarUrl)
  const { projects, loadProjects, moveChatToProject, deleteChat } =
    useChatsStore()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(name)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const DEBOUNCE_MS = 800

  useEffect(() => {
    if (chatId) {
      loadChat(chatId)
    }
    if (sidecarUrl) {
      setConnectionStatus('connected')
      getChatController(sidecarUrl)
    }
    loadProjects()
    return () => {
      resetChatController()
    }
  }, [chatId, loadChat, sidecarUrl, setConnectionStatus, loadProjects])

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
      // Also persist to chats table
      if (chatId) {
        chatsApi.rename(chatId, titleValue).catch(console.error)
      }
      nameTimeoutRef.current = null
    }, DEBOUNCE_MS)
    return () => {
      if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current)
    }
  }, [titleValue, loadedOnce, setName, saveCurrent, chatId])

  const handleTitleBlur = () => {
    setIsEditingTitle(false)
    setName(titleValue)
    saveCurrent()
    if (chatId) {
      chatsApi.rename(chatId, titleValue).catch(console.error)
    }
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

  const handleDelete = async () => {
    if (!chatId) return
    await deleteChat(chatId)
    setShowDeleteDialog(false)
    if (projectId) {
      navigate(`/project/${projectId}`)
    } else {
      navigate('/projects')
    }
  }

  const handleMove = async () => {
    if (!chatId || !selectedProjectId) return
    await moveChatToProject(chatId, selectedProjectId)
    setShowMoveDialog(false)
    setSelectedProjectId('')
    navigate(`/project/${selectedProjectId}`)
  }

  const handleValueChange = (value: string | null) => {
    if (value) setSelectedProjectId(value)
  }

  // Filter out current project from move options
  const otherProjects = projects.filter((p) => p.id !== projectId)

  const { width, isDragging, handleMouseDown, containerRef } =
    useResizablePanel(360, CHAT_MIN_WIDTH, 0.5)

  const resizeHandle = (
    <div
      className={`absolute top-0 right-0 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isDragging ? 'bg-primary/30' : ''}`}
      style={{ width: RESIZE_HANDLE_WIDTH, transform: 'translateX(50%)' }}
      onMouseDown={handleMouseDown}
    />
  )

  return (
    <div
      className='flex h-screen w-full bg-background overflow-hidden'
      ref={containerRef}
    >
      <ChatSidebar width={width} resizeHandle={resizeHandle} />
      <div className='flex flex-1 flex-col min-w-0'>
        <header className='flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2'>
          <div className='flex items-center gap-2 flex-1 min-w-0'>
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
          </div>
          <div className='flex items-center gap-2'>
            <span className='text-xs text-muted-foreground truncate'>
              {artifactName}
            </span>
            <SaveStatus lastSavedAt={lastSavedAt} isLoading={isLoading} />
            <DropdownMenu>
              <DropdownMenuTrigger className='hover:bg-accent hover:text-accent-foreground h-8 w-8 rounded-none inline-flex items-center justify-center'>
                <MoreVertical className='size-4' />
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => setShowMoveDialog(true)}>
                  <FolderInput className='size-4 mr-2' />
                  Move to project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className='text-destructive'
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className='size-4 mr-2' />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className='flex-1 p-4 min-h-0'>
          <ProjectEditor
            value={markdown}
            onChange={setMarkdown}
            isStreaming={isStreaming}
            className='h-full'
          />
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chat? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move Dialog */}
      <AlertDialog
        open={showMoveDialog}
        onOpenChange={(open) => {
          setShowMoveDialog(open)
          if (!open) setSelectedProjectId('')
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Project</AlertDialogTitle>
            <AlertDialogDescription>
              Select a project to move this chat to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='py-2'>
            <Select value={selectedProjectId} onValueChange={handleValueChange}>
              <SelectTrigger>
                <SelectValue placeholder='Select a project' />
              </SelectTrigger>
              <SelectContent>
                {otherProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMove}
              disabled={!selectedProjectId}
            >
              Move
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
