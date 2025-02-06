import { MdOutlineAllInbox } from 'react-icons/md'

export const EmptyNotificationState = ({ show }: { show: boolean }) => {
  if (!show) return null
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-8">
      <div className="rounded-full bg-gray-100 p-3">
        <MdOutlineAllInbox size={24} className="text-gray-400" />
      </div>
      <div className="text-center">
        <p className="text-gray-600">Your inbox is empty!</p>
        <p className="text-sm text-gray-500">
          You're all caught up. New notifications will appear here.
        </p>
      </div>
    </div>
  )
}
