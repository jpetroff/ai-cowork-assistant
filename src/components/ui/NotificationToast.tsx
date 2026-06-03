import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  XIcon,
  WarningIcon,
  InfoIcon,
  CheckCircleIcon,
  CopyIcon,
} from '@phosphor-icons/react'
import {
  useNotificationStore,
  type Notification,
  type NotificationKind,
} from '@/components/ui/notificationStore'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ── Icons & styles per kind ───────────────────────────────────────────────────

const KIND_CONFIG: Record<
  NotificationKind,
  { icon: React.ElementType; containerClass: string; iconClass: string }
> = {
  error: {
    icon: WarningIcon,
    containerClass: 'border-destructive/30 bg-background',
    iconClass: 'text-destructive',
  },
  warning: {
    icon: WarningIcon,
    containerClass: 'border-amber-400/30 bg-background',
    iconClass: 'text-amber-500',
  },
  success: {
    icon: CheckCircleIcon,
    containerClass: 'border-green-500/30 bg-background',
    iconClass: 'text-green-500',
  },
  info: {
    icon: InfoIcon,
    containerClass: 'border-border bg-background',
    iconClass: 'text-muted-foreground',
  },
}

// ── Single toast item ─────────────────────────────────────────────────────────

function ToastItem({ notification }: { notification: Notification }) {
  const navigate = useNavigate()
  const dismiss = useNotificationStore((s) => s.dismiss)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const config = KIND_CONFIG[notification.kind]
  const Icon = config.icon

  function handleCopy() {
    navigator.clipboard.writeText(notification.detail ?? notification.message)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleAction() {
    if (!notification.action) return
    navigate(notification.action.to)
    dismiss(notification.id)
  }

  return (
    <>
      <div
        role='alert'
        className={cn(
          'flex items-start gap-2.5 border p-3 text-xs shadow-sm w-72',
          config.containerClass
        )}
      >
        <Icon
          className={cn('mt-px size-3.5 shrink-0', config.iconClass)}
          weight='bold'
        />

        <span className='flex-1 leading-relaxed text-foreground'>
          {notification.message}
        </span>

        <div className='flex items-center gap-1 shrink-0'>
          {notification.action && (
            <Button
              variant='link'
              size='xs'
              className='h-auto p-0 text-xs text-muted-foreground hover:text-foreground'
              onClick={handleAction}
            >
              {notification.action.label}
            </Button>
          )}
          {notification.detail && (
            <Button
              variant='link'
              size='xs'
              className='h-auto p-0 text-xs text-muted-foreground hover:text-foreground'
              onClick={() => setDetailsOpen(true)}
            >
              details
            </Button>
          )}
          <Button
            variant='ghost'
            size='icon-xs'
            aria-label='Dismiss'
            onClick={() => dismiss(notification.id)}
          >
            <XIcon />
          </Button>
        </div>
      </div>

      {notification.detail && (
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Error details</DialogTitle>
              <DialogDescription>{notification.message}</DialogDescription>
            </DialogHeader>
            <pre className='bg-muted rounded-none p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap break-all'>
              {notification.detail}
            </pre>
            <DialogFooter>
              <Button variant='outline' size='sm' onClick={handleCopy}>
                <CopyIcon />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}

// ── Toast stack ───────────────────────────────────────────────────────────────

const MAX_VISIBLE = 5

export function NotificationToast() {
  const notifications = useNotificationStore((s) => s.notifications)
  const visible = notifications.slice(-MAX_VISIBLE)

  if (visible.length === 0) return null

  return (
    <div
      aria-live='polite'
      aria-label='Notifications'
      className='fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end'
    >
      {visible.map((n) => (
        <ToastItem key={n.id} notification={n} />
      ))}
    </div>
  )
}
