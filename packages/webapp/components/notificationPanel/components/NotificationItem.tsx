import { Avatar } from '@components/ui/Avatar'
import { formatTimeAgo } from '../helpers'
import NotificationIcon from './NotificationIcon'
import { useMarkNotificationAsRead } from '../hooks/useMarkNotificationAsRead'
import { useChatStore, useStore } from '@stores'
import PubSub from 'pubsub-js'
import { CHAT_OPEN } from '@services/eventsHub'
import { MdLink } from 'react-icons/md'
import * as toast from '@components/toast'
import NotificationBreadcrumb from './NotificationBreadcrumb'

export const NotificationItem = ({ notification }: { notification: any }) => {
  const { handleMarkAsRead } = useMarkNotificationAsRead()
  const {
    notificationActiveTab,
    settings: { metadata: docMetadata }
  } = useStore((state) => state)

  const { headingId } = useChatStore((state) => state.chatRoom)
  const destroyChatRoom = useChatStore((state) => state.destroyChatRoom)

  const handleViewNotification = (id: string, notification: any) => {
    // put the channelId and also the messageId in the uil history in order to later use it for fetching the message
    const messageId = notification.message_id
    const channelId = notification.channel_id

    if (headingId === channelId) destroyChatRoom()

    PubSub.publish(CHAT_OPEN, {
      headingId: channelId,
      toggleRoom: false,
      fetchMsgsFromId: messageId
    })
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
      className="my-2 flex w-full items-start gap-4 rounded-lg border border-gray-300 p-3 hover:bg-gray-50"
      key={notification.id}>
      <div className="h-10 w-10 flex-shrink-0">
        <Avatar
          id={notification.sender.id}
          src={notification.sender.avatar_url}
          avatarUpdatedAt={notification.sender.avatar_updated_at}
          width={24}
          height={24}
          clickable={false}
          className="h-[42px] min-h-[42px] w-[42px] cursor-pointer rounded-full border border-gray-300 shadow-md"
        />
      </div>

      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-2">
            <p className="flex flex-col items-start gap-1 text-sm font-bold">
              <span className="flex items-center gap-2">
                <NotificationIcon type={notification.type} size={16} />
                <span className="font-semibold">{notification.sender.display_name}</span>
              </span>
            </p>
            <div>
              <p className="rounded-md bg-gray-100 p-2 text-sm">{notification.message_preview}</p>
              {/* <div className="relative text-xs">
                <NotificationBreadcrumb channelId={notification.channel_id} />
              </div> */}
            </div>
          </div>
          <div>
            <button
              className="btn btn-sm btn-ghost btn-square flex items-center gap-2"
              onClick={() => handleCopyUrl(notification)}>
              <MdLink size={18} className="rotate-45" />
            </button>
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-gray-500">{formatTimeAgo(notification.created_at)}</span>
          {notificationActiveTab !== 'Archived' && (
            <button
              onClick={(e) => handleMarkAsRead(e, notification.id)}
              className="btn btn-ghost btn-sm ml-auto flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800">
              Mark as read
            </button>
          )}
          <button
            onClick={() => handleViewNotification(notification.message_id, notification)}
            className="btn btn-sm rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
            View
          </button>
        </div>
      </div>
    </div>
  )
}
