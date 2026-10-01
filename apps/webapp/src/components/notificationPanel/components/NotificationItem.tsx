import { armCompareFromLastLeft } from '@components/pages/history/armCompareFromLastLeft'
import {
  normalizeToPlainHistoryHash,
  parseHistoryHash
} from '@components/pages/history/historyShareUrl'
import {
  openChatAtMessage,
  PanelFeedActions,
  PanelFeedCopyLink,
  PanelFeedItem,
  PanelFeedMediaHint,
  PanelFeedPreview,
  PanelFeedRowAction
} from '@components/PanelFeedItem'
import { Avatar } from '@components/ui/Avatar'
import { useDismissPanelBeforeNavigate } from '@hooks/useDismissPanel'
import { openOverlayHash } from '@hooks/useHashOverlay'
import { Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'
import { type PanelSurfaceVariant, type TNotification } from '@types'
import { padSlugOf } from '@utils/filterRoute'
import { useRouter } from 'next/router'
import { LuTriangleAlert } from 'react-icons/lu'

import { useMarkNotificationAsRead } from '../hooks/useMarkNotificationAsRead'
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

  const profile = useAuthStore((state) => state.profile)
  const dismissBeforeNavigate = useDismissPanelBeforeNavigate(variant)
  const router = useRouter()

  const handleViewNotification = async (notification: TNotification) => {
    // First, because a sender-less carrier would otherwise be claimed by the
    // system test below. A carrier does carry a sender when the editor is known.
    if (notification.type === 'content_change') {
      void markAsRead(notification)
      // Compare the document segment, not the whole path: active filter terms
      // live in later segments, and a bare push would drop the reader's filters.
      const target = actionUrlPathname(notification.action_url)
      if (target) void armCompareFromLastLeft(notification.channel_id, profile?.id)
      await dismissBeforeNavigate()
      if (!target) return

      if (padSlugOf(target) !== padSlugOf(window.location.pathname)) {
        void router.push(`${target}#history`)
        return
      }
      const historyHash = parseHistoryHash(window.location.hash)
      if (!historyHash.isHistory) {
        window.location.hash = 'history'
        return
      }
      if (historyHash.version != null) normalizeToPlainHistoryHash()
      return
    }

    if (isSystemNotification(notification)) {
      void markAsRead(notification)
      await dismissBeforeNavigate()
      // The email-bounce alert is the one system producer. Its fix lives on this tab.
      openOverlayHash('settings', 'notifications')
      return
    }

    await dismissBeforeNavigate()
    openChatAtMessage(notification.channel_id, notification.message_id)
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
            <PanelFeedPreview media={<PanelFeedMediaHint preview={notification.message_preview} />}>
              {notification.message_preview}
            </PanelFeedPreview>
          </div>
          {!isSystem && !isContentChange && (
            <PanelFeedCopyLink
              messageId={notification.message_id}
              channelId={notification.channel_id}
              disabled={exiting}
            />
          )}
        </div>

        <PanelFeedActions
          createdAt={notification.created_at}
          onView={() => void handleViewNotification(notification)}
          viewLabel={isSystem ? 'Review' : 'View'}
          disabled={exiting}>
          {notificationActiveTab !== 'Read' && (
            <PanelFeedRowAction onClick={() => void markAsRead(notification)} disabled={exiting}>
              Mark as read
            </PanelFeedRowAction>
          )}
        </PanelFeedActions>
      </div>
    </PanelFeedItem>
  )
}
