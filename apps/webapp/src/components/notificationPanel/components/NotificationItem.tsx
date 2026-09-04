import { PanelFeedItem } from '@components/PanelFeedItem'
import * as toast from '@components/toast'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { useDismissPanel } from '@hooks/useDismissPanel'
import { Icons } from '@icons'
import { CHAT_OPEN } from '@services/eventsHub'
import { useChatStore, useStore } from '@stores'
import { type PanelSurfaceVariant, type TNotification } from '@types'
import { formatTimeAgo } from '@utils/formatTime'
import { useRouter } from 'next/router'
import PubSub from 'pubsub-js'
import { LuLink, LuTriangleAlert } from 'react-icons/lu'

import { useMarkNotificationAsRead } from '../hooks/useMarkNotificationAsRead'
import { NotificationAttachmentHint } from './NotificationAttachmentHint'
import NotificationIcon from './NotificationIcon'

const isSystemNotification = (notification: TNotification): boolean =>
  notification.type === 'system_alert' || !notification.sender?.id

/** `action_url` is absolute, so it parses with no base and stays stable across hydration. */
const actionUrlPathname = (actionUrl: string | null | undefined): string | null => {
  if (!actionUrl) return null
  try {
    return new URL(actionUrl).pathname
  } catch {
    return null
  }
}

/** A carrier row has no title column, so its only document identity is the link slug. */
const documentNameFromActionUrl = (actionUrl: string | null | undefined): string => {
  const slug = actionUrlPathname(actionUrl)?.split('/').filter(Boolean).pop()
  if (!slug) return 'Document'
  try {
    return decodeURIComponent(slug)
  } catch {
    return slug
  }
}

type NotificationItemProps = {
  notification: TNotification
  variant?: PanelSurfaceVariant
}

export const NotificationItem = ({ notification, variant = 'popover' }: NotificationItemProps) => {
  const { markAsRead, isDismissing } = useMarkNotificationAsRead()
  const notificationActiveTab = useStore((state) => state.notificationActiveTab)
  const exiting = isDismissing(notification.id)

  const { headingId } = useChatStore((state) => state.chatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const dismissPanel = useDismissPanel(variant)
  const router = useRouter()

  const handleViewNotification = (notification: TNotification) => {
    // First, because a sender-less carrier would otherwise be claimed by the
    // system test below. A carrier does carry a sender when the editor is known.
    if (notification.type === 'content_change') {
      void markAsRead(notification)
      dismissPanel()

      // Compare the document segment, not the whole path: active filter terms
      // live in later segments, and a bare push would drop the reader's filters.
      const target = actionUrlPathname(notification.action_url)
      const slugOf = (path: string) => path.split('/')[1] ?? ''
      if (target && slugOf(target) !== slugOf(window.location.pathname)) void router.push(target)
      return
    }

    if (isSystemNotification(notification)) {
      void markAsRead(notification)
      dismissPanel()
      toast.Info('Check your email settings in Profile → Notifications')
      return
    }

    const messageId = notification.message_id
    const channelId = notification.channel_id

    if (headingId === channelId) destroyChatRoom()

    PubSub.publish(CHAT_OPEN, {
      headingId: channelId,
      toggleRoom: false,
      fetchMsgsFromId: messageId,
      scroll2Heading: true
    })

    dismissPanel()
  }

  const handleCopyUrl = (notification: TNotification) => {
    // A carrier has no message, so half a link opens nothing.
    if (!notification.message_id || !notification.channel_id) return

    const newURL = new URL(location.href)
    newURL.searchParams.set('msg_id', notification.message_id)
    newURL.searchParams.set('chatroom', notification.channel_id)

    navigator.clipboard
      .writeText(newURL.toString())
      .then(() => {
        toast.Success('URL copied to clipboard')
      })
      .catch((err) => {
        console.error('Failed to copy URL:', err)
        toast.Error('Failed to copy URL')
      })
  }

  const isContentChange = notification.type === 'content_change'
  const isSystem = isSystemNotification(notification) && !isContentChange
  const hasSender = Boolean(notification.sender?.id)

  return (
    <PanelFeedItem exiting={exiting}>
      <div className="size-8 shrink-0">
        {isSystem ? (
          <div className="bg-warning/15 text-warning flex size-8 items-center justify-center rounded-full">
            <LuTriangleAlert size={18} />
          </div>
        ) : hasSender ? (
          <Avatar face={notification.sender} clickable={false} size="sm" />
        ) : (
          // A sender-less carrier has no face, and Avatar would mint a fabricated one.
          <div className="bg-base-300/40 text-base-content/70 flex size-8 items-center justify-center rounded-full">
            <Icons.pencil size={18} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <p className="flex items-center gap-1.5 text-sm">
              <NotificationIcon type={notification.type} size={14} />
              <span className="text-base-content font-medium">
                {isSystem
                  ? 'System'
                  : hasSender
                    ? notification.sender?.display_name
                    : documentNameFromActionUrl(notification.action_url)}
              </span>
            </p>
            <div className="flex w-full min-w-0 items-start gap-2">
              <NotificationAttachmentHint preview={notification.message_preview} />
              <p className="bg-base-200 text-base-content/70 rounded-field line-clamp-2 min-w-0 flex-1 px-2 py-1 text-sm">
                {notification.message_preview}
              </p>
            </div>
          </div>
          {!isSystem && !isContentChange && (
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              className="text-base-content/50 hover:text-base-content shrink-0"
              onClick={() => handleCopyUrl(notification)}
              aria-label="Copy link">
              <LuLink size={14} className="rotate-45" />
            </Button>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-base-content/50 text-xs">
            {formatTimeAgo(notification.created_at)}
          </span>
          {notificationActiveTab !== 'Read' && (
            <Button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void markAsRead(notification)
              }}
              variant="ghost"
              size="xs"
              className="text-primary hover:bg-primary/10"
              disabled={exiting}
              aria-busy={exiting}>
              Mark as read
            </Button>
          )}
          <Button
            onClick={() => handleViewNotification(notification)}
            variant={isSystem ? 'warning' : 'primary'}
            btnStyle="soft"
            size="xs"
            className="ml-auto"
            disabled={exiting}>
            {isSystem ? 'Review' : 'View'}
          </Button>
        </div>
      </div>
    </PanelFeedItem>
  )
}
