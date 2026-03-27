import { useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useMessageStore } from '@/stores/messageStore'
import { useArtifactStore } from '@/stores/artifactStore'
import { useSidecarStore } from '@/stores/sidecarStore'

export function ChatInput() {
  const [value, setValue] = useState('')
  const isStreaming = useMessageStore((s) => s.isStreaming)
  const addUserMessage = useMessageStore((s) => s.addUserMessage)
  const sealForSend = useArtifactStore((s) => s.sealForSend)
  const sendChatRequest = useSidecarStore((s) => s.sendChatRequest)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSubmit = value.trim().length > 0 && !isStreaming

  const handleSubmit = async () => {
    const content = value.trim()
    if (!content || isStreaming) return
    setValue('')

    // 2. Persist user message to DB
    await addUserMessage(content)

    // 3. Seal the active artifact revision; system message created automatically if a revision is sealed
    const sealResult = await sealForSend()

    // 4. Send to sidecar
    await sendChatRequest(content, sealResult)

    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t p-3 shrink-0">
      {/* STUB: selection-context — show editor selection badge here (FR-CHT-005) */}
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'Assistant is writing…' : 'Message… (⌘↵ to send)'}
          disabled={isStreaming}
          rows={3}
          className="resize-none flex-1 text-sm"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  )
}
