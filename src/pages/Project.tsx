import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  Plus,
  Send,
  MoreVertical,
  Pencil,
  Trash2,
  FolderInput,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import * as chatsApi from '@/lib/chats'
import * as messagesApi from '@/lib/messages'
import * as projectsApi from '@/lib/projects'
import { useChatsStore } from '@/stores/chats-store'
import type { Project } from '@/lib/projects'
import type { Chat } from '@/lib/chats'

export function Project() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const {
    chats,
    isLoading,
    loadChats,
    renameChat,
    deleteChat,
    moveChatToProject,
    loadProjects,
    projects,
  } = useChatsStore()

  const [project, setProject] = useState<Project | null>(null)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  // Dialog states
  const [renameChatId, setRenameChatId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteChatId, setDeleteChatId] = useState<string | null>(null)
  const [moveChatId, setMoveChatId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  // Load project and chats
  useEffect(() => {
    if (!projectId) return
    const load = async () => {
      const p = await projectsApi.get(projectId)
      setProject(p)
      await loadChats(projectId)
      await loadProjects()
    }
    load()
  }, [projectId, loadChats, loadProjects])

  const handleValueChange = (value: string | null) => {
    if (value) setSelectedProjectId(value)
  }

  const handleOpenChat = useCallback(
    (chatId: string) => {
      if (!projectId) return
      navigate(`/project/${projectId}/chat/${chatId}`)
    },
    [projectId, navigate]
  )

  const handleCreateChat = async () => {
    if (!projectId) return

    setIsSending(true)
    try {
      const chatId = await chatsApi.insert({
        project_id: projectId,
        name: 'New Chat',
      })
      navigate(`/project/${projectId}/chat/${chatId}`)
    } catch (err) {
      console.error('Failed to create chat:', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleSend = async () => {
    if (!message.trim() || !projectId) return

    setIsSending(true)
    try {
      const chatId = await chatsApi.insert({
        project_id: projectId,
        name: 'New Chat',
      })
      await messagesApi.insert({
        chat_id: chatId,
        role: 'user',
        content: message.trim(),
      })
      navigate(`/project/${projectId}/chat/${chatId}`)
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleRename = async () => {
    if (!renameChatId || !renameValue.trim()) return
    await renameChat(renameChatId, renameValue.trim())
    setRenameChatId(null)
    setRenameValue('')
  }

  const handleDelete = async () => {
    if (!deleteChatId) return
    await deleteChat(deleteChatId)
    setDeleteChatId(null)
  }

  const handleMove = async () => {
    if (!moveChatId || !selectedProjectId) return
    await moveChatToProject(moveChatId, selectedProjectId)
    setMoveChatId(null)
    setSelectedProjectId('')
  }

  const openRenameDialog = (chat: Chat) => {
    setRenameChatId(chat.id)
    setRenameValue(chat.name)
  }

  const openMoveDialog = (chatId: string) => {
    setMoveChatId(chatId)
    setSelectedProjectId('')
  }

  // Filter out current project from move options
  const otherProjects = projects.filter((p) => p.id !== projectId)

  return (
    <div className='flex flex-col h-screen'>
      <header className='flex items-center justify-between gap-4 border-b border-border px-6 py-4'>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='icon-xs'
            onClick={() => navigate('/projects')}
          >
            <ArrowLeft className='size-4' />
          </Button>
          <h1 className='text-lg font-semibold'>
            {project?.name || 'Project'}
          </h1>
        </div>
      </header>

      <main className='flex-1 overflow-auto p-6'>
        <div className='max-w-4xl mx-auto'>
          {isLoading ? (
            <div className='flex items-center justify-center h-32 text-muted-foreground'>
              Loading...
            </div>
          ) : (
            <>
              <div className='mb-6'>
                <h2 className='text-sm font-medium text-muted-foreground mb-3'>
                  Start a conversation
                </h2>
                <div className='flex gap-2'>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Type your message...'
                    className='min-h-[80px] resize-none'
                    disabled={isSending}
                  />
                  <Button
                    size='icon'
                    disabled={isSending || !message.trim()}
                    onClick={handleSend}
                  >
                    <Send className='size-4' />
                  </Button>
                </div>
              </div>

              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-sm font-medium text-muted-foreground'>
                  Chats ({chats.length})
                </h2>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleCreateChat}
                  disabled={isSending}
                >
                  <Plus className='size-4 mr-1' />
                  Create new chat
                </Button>
              </div>

              {chats.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12 text-muted-foreground'>
                  <p>No chats yet. Send a message to create one.</p>
                </div>
              ) : (
                <div className='flex flex-col gap-2'>
                  {chats.map((chat) => (
                    <Card
                      key={chat.id}
                      className='cursor-pointer hover:border-primary/50 transition-colors'
                      onClick={() => handleOpenChat(chat.id)}
                    >
                      <CardHeader className='pb-2'>
                        <div className='flex items-start justify-between gap-2'>
                          <CardTitle
                            className='text-base truncate'
                            title={chat.name}
                          >
                            {chat.name}
                          </CardTitle>
                          <div className='flex items-center gap-1 shrink-0'>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className='hover:bg-accent hover:text-accent-foreground h-7 w-7 rounded-none inline-flex items-center justify-center'
                                onClick={(e: React.MouseEvent) =>
                                  e.stopPropagation()
                                }
                              >
                                <MoreVertical className='size-3' />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end'>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openRenameDialog(chat)
                                  }}
                                >
                                  <Pencil className='size-4 mr-2' />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    openMoveDialog(chat.id)
                                  }}
                                >
                                  <FolderInput className='size-4 mr-2' />
                                  Move to project
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className='text-destructive'
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDeleteChatId(chat.id)
                                  }}
                                >
                                  <Trash2 className='size-4 mr-2' />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <p className='text-xs text-muted-foreground'>
                          Updated{' '}
                          {formatDistanceToNow(chat.updated_at, {
                            addSuffix: true,
                          })}
                        </p>
                      </CardHeader>
                      <CardContent className='pt-0'>
                        <p className='text-xs text-muted-foreground'>
                          Created{' '}
                          {formatDistanceToNow(chat.created_at, {
                            addSuffix: true,
                          })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Rename Dialog */}
      <AlertDialog
        open={!!renameChatId}
        onOpenChange={() => setRenameChatId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename Chat</AlertDialogTitle>
          </AlertDialogHeader>
          <div className='py-2'>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setRenameChatId(null)
              }}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRename}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteChatId}
        onOpenChange={() => setDeleteChatId(null)}
      >
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
        open={!!moveChatId}
        onOpenChange={() => {
          setMoveChatId(null)
          setSelectedProjectId('')
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
