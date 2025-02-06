import { Avatar } from '@components/ui/Avatar'
import { formatTimeAgo } from '../helpers'
import NotificationIcon from './NotificationIcon'
import { useMarkNotificationAsRead } from '../hooks/useMarkNotificationAsRead'
import { useStore } from '@stores'

export const NotificationItem = ({ notification }: { notification: any }) => {
  const { handleMarkAsRead } = useMarkNotificationAsRead()
  const {
    notificationActiveTab,
    settings: { metadata: docMetadata }
  } = useStore((state) => state)

  return (
    <div
      className="my-2 flex w-full items-start gap-4 rounded-lg border p-3 hover:bg-gray-50"
      key={notification.id}>
      <div className="h-10 w-10 flex-shrink-0">
        <Avatar
          id={notification.sender.id}
          src={notification.sender.avatar_url}
          avatarUpdatedAt={notification.sender.avatar_updated_at}
          width={24}
          height={24}
          clickable={false}
          className="h-[42px] min-h-[42px] w-[42px] cursor-pointer rounded-full border shadow-md"
        />
      </div>

      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-2">
            <p className="flex flex-col items-start gap-1 text-sm font-bold">
              <span className="flex items-center gap-1">
                <NotificationIcon type={notification.type} />
                <span className="font-semibold">
                  {notification.sender.display_name ||
                    notification.sender.full_name ||
                    notification.sender.username}
                </span>
              </span>

              <span className="ml-6 text-xs text-gray-500">
                {document.querySelector(`.heading[data-id="${notification.channel_id}"] .title`)
                  ?.textContent || docMetadata?.title}
              </span>
            </p>
            <p className="rounded-md bg-gray-100 p-2 text-sm">{notification.message_preview}</p>
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
          {/* <button className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
            View
          </button> */}
        </div>
      </div>
    </div>
  )
}
