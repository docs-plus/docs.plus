import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { formatTimeAgo } from '../helpers'
import NotificationIcon from './NotificationIcon'
import { useMarkNotificationAsRead } from '../hooks/useMarkNotificationAsRead'
import { useChatStore, useStore } from '@stores'
import PubSub from 'pubsub-js'
import { CHAT_OPEN } from '@services/eventsHub'
import { LuLink } from 'react-icons/lu'
import * as toast from '@components/toast'
import { usePopoverState } from '@components/ui/Popover'

export const NotificationItem = ({ notification }: { notification: any }) => {
  const { handleMarkAsRead } = useMarkNotificationAsRead()
  const { notificationActiveTab } = useStore((state) => state)

  const { headingId } = useChatStore((state) => state.chatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)
  const { close: closePopover } = usePopoverState()

  const handleViewNotification = (id: string, notification: any) => {
    const messageId = notification.message_id
    const channelId = notification.channel_id

    if (headingId === channelId) destroyChatRoom()

    PubSub.publish(CHAT_OPEN, {
      headingId: channelId,
      toggleRoom: false,
      fetchMsgsFromId: messageId,
      scroll2Heading: true
    })

    closePopover()
  }

  const handleCopyUrl = (notification: any) => {
    const messageId = notification.message_id
    const channelId = notification.channel_id

    const newURL = new URL(location.href)
    newURL.searchParams.set('msg_id', messageId)
    newURL.searchParams.set('chatroom', channelId)

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

  return (
    <div
      className="rounded-box border-base-300 bg-base-100 hover:bg-base-200 flex w-full items-start gap-3 border p-3 transition-colors"
      key={notification.id}>
      <div className="size-9 flex-shrink-0">
        <Avatar
          id={notification.sender.id}
          src={notification.sender.avatar_url}
          avatarUpdatedAt={notification.sender.avatar_updated_at}
          clickable={false}
          className="border-base-300 size-9 rounded-full border"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <p className="flex items-center gap-1.5 text-sm">
              <NotificationIcon type={notification.type} size={14} />
              <span className="text-base-content font-medium">
                {notification.sender.display_name}
              </span>
            </p>
            <p className="bg-base-200 text-base-content/70 line-clamp-2 w-full rounded-lg px-2 py-1 text-sm">
              {notification.message_preview}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            className="text-base-content/50 hover:text-base-content shrink-0"
            onClick={() => handleCopyUrl(notification)}
            aria-label="Copy link">
            <LuLink size={14} className="rotate-45" />
          </Button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-base-content/50 text-xs">
            {formatTimeAgo(notification.created_at)}
          </span>
          {notificationActiveTab !== 'Read' && (
            <Button
              onClick={(e) => handleMarkAsRead(e, notification.id)}
              variant="ghost"
              size="xs"
              className="text-primary hover:bg-primary/10">
              Mark as read
            </Button>
          )}
          <Button
            onClick={() => handleViewNotification(notification.message_id, notification)}
            variant="primary"
            btnStyle="soft"
            size="xs"
            className="ml-auto">
            View
          </Button>
        </div>
      </div>
    </div>
  )
}
