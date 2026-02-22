import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Plus, Send } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import * as chatsApi from '@/lib/chats'
import * as messagesApi from '@/lib/messages'
import * as projectsApi from '@/lib/projects'
import type { Project } from '@/lib/projects'
import type { Chat } from '@/lib/chats'

export function Project() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [chatList, setChatList] = useState<Chat[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (!projectId) return

    const load = async () => {
      setIsLoading(true)
      const p = await projectsApi.get(projectId)
      setProject(p)
      const c = await chatsApi.listByProject(projectId)
      setChatList(c)
      setIsLoading(false)
    }
    load()
  }, [projectId])

  const handleOpenChat = (chatId: string) => {
    navigate(`/project/${projectId}/chat/${chatId}`)
  }

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

  return (
    <div className='flex flex-col min-h-screen'>
      <header className='flex items-center justify-between gap-4 border-b border-border px-6 py-4'>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='icon-xs'
            onClick={() => navigate('/projects')}
          >
            <ArrowLeft className='size-4' />
          </Button>
          <h1 className='text-lg font-semibold'>{project?.name || 'Project'}</h1>
        </div>
      </header>

      <main className='flex-1 overflow-auto p-6'>
        <div className='max-w-[800px] mx-auto px-4 sm:px-6'>
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
                  Chats ({chatList.length})
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

              {chatList.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12 text-muted-foreground'>
                  <p>No chats yet. Send a message to create one.</p>
                </div>
              ) : (
                <div className='flex flex-col gap-2'>
                  {chatList.map((chat) => (
                    <Card
                      key={chat.id}
                      className='cursor-pointer hover:border-primary/50 transition-colors'
                      onClick={() => handleOpenChat(chat.id)}
                    >
                      <CardHeader className='pb-2'>
                        <p className='text-sm font-medium text-foreground'>
                          Chat
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          Updated{' '}
                          {formatDistanceToNow(chat.updated_at, { addSuffix: true })}
                        </p>
                      </CardHeader>
                      <CardContent className='pt-0'>
                        <p className='text-xs text-muted-foreground'>
                          Created{' '}
                          {formatDistanceToNow(chat.created_at, { addSuffix: true })}
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
    </div>
  )
}