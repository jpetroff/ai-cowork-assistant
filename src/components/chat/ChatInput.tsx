import { useChatStore } from '@/stores/chat-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Send, Loader2 } from 'lucide-react'

export function ChatInput() {
  const inputText = useChatStore((s) => s.inputText)
  const setInputText = useChatStore((s) => s.setInputText)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const connectionStatus = useChatStore((s) => s.connectionStatus)
  const messages = useChatStore((s) => s.messages)

  const isStreaming = messages.some((m) => m.status === 'streaming')
  const isConnected = connectionStatus === 'connected'
  const isDisabled = !inputText.trim() || !isConnected || isStreaming

  const handleSend = () => {
    if (!isDisabled) {
      sendMessage(inputText.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className='flex gap-2'>
      <Input
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
        disabled={!isConnected || isStreaming}
        className='text-sm flex-1'
        aria-label='Chat input'
      />
      <Button
        size='icon-sm'
        onClick={handleSend}
        disabled={isDisabled}
        aria-label='Send message'
      >
        {isStreaming ? (
          <Loader2 className='size-4 animate-spin' />
        ) : (
          <Send className='size-4' />
        )}
      </Button>
    </div>
  )
}
