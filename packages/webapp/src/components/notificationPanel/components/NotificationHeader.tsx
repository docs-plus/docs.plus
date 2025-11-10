import { IoCheckmarkDoneSharp } from 'react-icons/io5'
import { useMarkAllNotificationsAsRead } from '../hooks/useMarkAllNotificationsAsRead'

export const NotificationHeader = () => {
  const { handleMarkAllAsRead } = useMarkAllNotificationsAsRead()

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-bold">Your Notifications</h1>
      <button
        onClick={handleMarkAllAsRead}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
        <span className="flex items-center gap-2 text-sm font-bold">
          <IoCheckmarkDoneSharp size={18} />
          Mark all as read
        </span>
      </button>
    </div>
  )
}
