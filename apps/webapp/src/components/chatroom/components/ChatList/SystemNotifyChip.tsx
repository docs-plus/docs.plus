import type { MessageRow } from '@components/chatroom/types/chat-items'
import type { ChatroomVariant } from '@components/chatroom/types/chatroom.types'
import { Avatar } from '@components/ui/Avatar'
import { DocsPlusIcon } from '@icons'
import { useStore } from '@stores'
import { getMetadataProperty } from '@utils/metadata'
import { formatDistanceToNow } from 'date-fns'
import type { MouseEventHandler, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

import { useMentionClick } from '../../hooks/useMentionClick'

type Props = {
  message: MessageRow
  variant?: keyof ChatroomVariant
}

type ChipShellProps = {
  children: ReactNode
  dateAttr?: string
  onClick?: MouseEventHandler<HTMLDivElement>
}

const TIME_CLASS = 'text-base-content/50 shrink-0 text-[11px] leading-none whitespace-nowrap'

const NotifyUserAvatar = ({ message }: { message: MessageRow }) => {
  const ud = message.user_details
  const id = ud?.id ?? message.user_id
  if (!id) return null

  return (
    <div className="avatar shrink-0">
      <Avatar face={{ ...ud, id }} size="sm" alt="user" />
    </div>
  )
}

const MentionLabel = ({ message, className }: { message: MessageRow; className?: string }) => {
  const username = message.user_details?.username?.trim()
  const fallback = message.user_details?.fullname?.trim() || 'someone'
  const label = username ?? fallback

  if (!username) {
    return <span className={twMerge('font-semibold', className)}>{label}</span>
  }

  return (
    <span
      className={twMerge('mention text-primary cursor-pointer !p-0 font-semibold', className)}
      data-type="mention"
      data-id={message.user_id ?? ''}
      data-label={username}>
      @{username}
    </span>
  )
}

const DesktopChip = ({ children, dateAttr, onClick }: ChipShellProps) => (
  <div
    className="msg_card my-2 flex w-full justify-center px-4 pb-1"
    data-msg-date={dateAttr}
    onClick={onClick}>
    <div className="bg-info/10 inline-flex max-w-[90%] flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-full px-3 py-1.5 text-center text-xs leading-relaxed">
      {children}
    </div>
  </div>
)

type MobileChipProps = ChipShellProps & {
  message?: MessageRow
  showAvatar?: boolean
}

const MobileChip = ({
  message,
  children,
  dateAttr,
  onClick,
  showAvatar = false
}: MobileChipProps) => (
  <div
    className="msg_card my-6 flex w-full items-center justify-center px-3 pb-1"
    data-msg-date={dateAttr}>
    <div
      className="border-info/15 bg-info/10 text-base-content rounded-field flex w-[94%] max-w-[94%] min-w-0 items-start gap-2.5 border px-3 py-2.5 text-xs leading-snug"
      onClick={onClick}>
      {showAvatar && message ? <NotifyUserAvatar message={message} /> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  </div>
)

const MobileTimedRow = ({
  timeAgo,
  align = 'start',
  children
}: {
  timeAgo: string
  align?: 'start' | 'center'
  children: ReactNode
}) => (
  <div
    className={twMerge(
      'flex justify-between gap-3',
      align === 'center' ? 'items-center' : 'items-start'
    )}>
    <div className="min-w-0 flex-1">{children}</div>
    {timeAgo ? <span className={TIME_CLASS}>{timeAgo}</span> : null}
  </div>
)

export const SystemNotifyChip = ({ message, variant = 'desktop' }: Props) => {
  const docMetadata = useStore((state) => state.settings.metadata)
  const handleMentionClick = useMentionClick()
  const isMobile = variant === 'mobile'

  const metadataType = getMetadataProperty<string>(message.metadata, 'type')
  if (metadataType === 'user_join_channel') return null

  const timeAgo = message.created_at
    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
    : ''
  const dateAttr = (message.created_at ?? '').slice(0, 10) || undefined

  switch (metadataType) {
    case 'user_join_workspace': {
      const docTitle = docMetadata?.title ?? 'this document'

      if (isMobile) {
        return (
          <MobileChip message={message} dateAttr={dateAttr} onClick={handleMentionClick} showAvatar>
            <MobileTimedRow timeAgo={timeAgo}>
              <p>
                <MentionLabel message={message} />
                <span className="text-base-content/75"> joined</span>
              </p>
            </MobileTimedRow>
            <p className="mt-1.5 flex min-w-0 items-center gap-1.5">
              <DocsPlusIcon size={14} className="text-primary shrink-0" />
              <span className="truncate font-medium underline">{docTitle}</span>
            </p>
          </MobileChip>
        )
      }

      return (
        <DesktopChip dateAttr={dateAttr} onClick={handleMentionClick}>
          <MentionLabel message={message} />
          <span>joined</span>
          <span className="inline-flex items-center gap-1">
            <DocsPlusIcon size={12} />
            <span className="font-medium underline">{docTitle}</span>
          </span>
          <span>— {timeAgo}</span>
        </DesktopChip>
      )
    }

    case 'channel_created':
      if (isMobile) {
        return (
          <MobileChip dateAttr={dateAttr}>
            <MobileTimedRow timeAgo={timeAgo} align="center">
              <span className="font-medium">Heading created</span>
            </MobileTimedRow>
          </MobileChip>
        )
      }

      return <DesktopChip dateAttr={dateAttr}>Heading created — {timeAgo}</DesktopChip>

    default:
      if (isMobile) {
        return (
          <MobileChip message={message} dateAttr={dateAttr} showAvatar={!!message.user_id}>
            <MobileTimedRow timeAgo={timeAgo}>
              <span>{message.content}</span>
            </MobileTimedRow>
          </MobileChip>
        )
      }

      return (
        <DesktopChip dateAttr={dateAttr}>
          {message.content}
          {timeAgo ? <> — {timeAgo}</> : null}
        </DesktopChip>
      )
  }
}
