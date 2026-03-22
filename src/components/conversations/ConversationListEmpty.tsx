import { CircleDashedIcon } from '@phosphor-icons/react'

export function ConversationListEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <CircleDashedIcon className="size-8 text-muted-foreground/40" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">No chats yet</p>
        <p className="text-xs text-muted-foreground/70">
          Start a task above to create your first chat
        </p>
      </div>
    </div>
  )
}
