import { LuInbox } from 'react-icons/lu'

export const EmptyNotificationState = ({ show }: { show: boolean }) => {
  if (!show) return null
  return (
    <div className="flex flex-col items-center justify-center space-y-3 py-8">
      <div className="bg-base-200 flex size-12 items-center justify-center rounded-full">
        <LuInbox size={24} className="text-base-content/40" />
      </div>
      <div className="text-center">
        <p className="text-base-content font-medium">Your inbox is empty!</p>
        <p className="text-base-content/60 text-sm">
          You're all caught up. New notifications will appear here.
        </p>
      </div>
    </div>
  )
}
