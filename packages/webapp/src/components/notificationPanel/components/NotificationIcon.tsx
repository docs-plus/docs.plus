import { Tooltip } from '@components/ui/Tooltip'
import { Icons } from '@icons'

const NotificationIcon = ({ type, size = 16 }: { type: string; size?: number }) => {
  const iconProps = { size, className: 'text-base-content/60' }

  const iconMap: Record<string, { icon: React.ReactNode; label: string }> = {
    mention: { icon: <Icons.mention {...iconProps} />, label: 'Mention' },
    message: { icon: <Icons.thread {...iconProps} />, label: 'Message' },
    reply: { icon: <Icons.reply {...iconProps} />, label: 'Reply' },
    reaction: { icon: <Icons.emoji {...iconProps} />, label: 'Reaction' },
    thread_message: { icon: <Icons.messagesSquare {...iconProps} />, label: 'Thread Message' },
    channel_event: { icon: <Icons.megaphone {...iconProps} />, label: 'Channel Event' },
    direct_message: { icon: <Icons.mail {...iconProps} />, label: 'Direct Message' },
    invitation: { icon: <Icons.share {...iconProps} />, label: 'Invitation' },
    system_alert: { icon: <Icons.alert {...iconProps} />, label: 'System Alert' }
  }

  const entry = iconMap[type]
  if (!entry) return null

  return (
    <Tooltip title={entry.label} placement="right">
      <span>{entry.icon}</span>
    </Tooltip>
  )
}

export default NotificationIcon
