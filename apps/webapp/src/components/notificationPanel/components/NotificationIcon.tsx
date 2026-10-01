import { Tooltip } from '@components/ui/Tooltip'
import { Icons } from '@icons'

const NotificationIcon = ({ type, size = 16 }: { type: string; size?: number }) => {
  const iconProps = { size, className: 'text-base-content/60' }

  const iconMap: Record<string, { icon: React.ReactNode; label: string }> = {
    mention: { icon: <Icons.mention {...iconProps} />, label: 'Mention' },
    message: { icon: <Icons.thread {...iconProps} />, label: 'Message' },
    reply: { icon: <Icons.reply {...iconProps} />, label: 'Reply' },
    reaction: { icon: <Icons.emoji {...iconProps} />, label: 'Reaction' },
    thread_message: { icon: <Icons.messagesSquare {...iconProps} />, label: 'Thread message' },
    channel_event: { icon: <Icons.megaphone {...iconProps} />, label: 'Channel event' },
    direct_message: { icon: <Icons.mail {...iconProps} />, label: 'Direct message' },
    invitation: { icon: <Icons.share {...iconProps} />, label: 'Invitation' },
    content_change: { icon: <Icons.pencil {...iconProps} />, label: 'Document change' },
    system_alert: { icon: <Icons.alert {...iconProps} />, label: 'System alert' }
  }

  const entry = iconMap[type]
  if (!entry) return null

  // The Tooltip shows on hover only, so the span carries the type name for assistive tech.
  return (
    <Tooltip title={entry.label} placement="right">
      <span role="img" aria-label={entry.label}>
        {entry.icon}
      </span>
    </Tooltip>
  )
}

export default NotificationIcon
