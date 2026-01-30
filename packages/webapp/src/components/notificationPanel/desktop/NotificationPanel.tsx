import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'
import { TTab } from '@types'

import { EmptyNotificationState } from '../components/EmptyNotificationState'
import { NotificationHeader } from '../components/NotificationHeader'
import { NotificationItem } from '../components/NotificationItem'
import { NotificationSkeleton } from '../components/NotificationSkeleton'
import { useInfiniteNotifications } from '../hooks/useInfiniteNotifications'
import { useNotificationSummary } from '../hooks/useNotificationSummary'

interface NotificationPanelProps {
  onClose?: () => void
}

export const NotificationPanel = ({ onClose }: NotificationPanelProps) => {
  const { notificationActiveTab, notificationTabs, setNotificationActiveTab } = useStore(
    (state) => state
  )

  useNotificationSummary()

  const { notifications, isLoading, isLoadingMore, hasMore, sentinelRef } =
    useInfiniteNotifications()

  return (
    <div className="bg-base-100 flex w-full flex-col">
      {/* Header */}
      <div className="border-base-300 border-b px-4 py-3">
        <NotificationHeader onClose={onClose} />
      </div>

      {/* Tabs */}
      <div className="border-base-300 flex gap-1 border-b px-4 py-2">
        {notificationTabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setNotificationActiveTab(tab.label as TTab)}
            className={`rounded-selector px-3 py-1.5 text-sm font-medium transition-colors ${
              notificationActiveTab === tab.label
                ? 'bg-primary text-primary-content'
                : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
            }`}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`ml-1.5 ${
                  notificationActiveTab === tab.label
                    ? 'text-primary-content/80'
                    : 'text-base-content/50'
                }`}>
                ({tab.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content with infinite scroll */}
      <ScrollArea
        className="max-h-96 min-h-48 p-3"
        scrollbarSize="thin"
        hideScrollbar
        preserveWidth={false}>
        {/* Loading skeleton */}
        {isLoading && notifications.length === 0 && <NotificationSkeleton count={4} />}

        {/* Empty state */}
        <EmptyNotificationState show={!isLoading && notifications.length === 0} />

        {/* Notifications list */}
        {notifications.length > 0 && (
          <div className="flex flex-col gap-2">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-3">
                {isLoadingMore && (
                  <div className="loading loading-spinner loading-sm text-primary" />
                )}
              </div>
            )}

            {/* End of list indicator */}
            {!hasMore && notifications.length > 0 && (
              <p className="text-base-content/40 py-3 text-center text-xs">No more notifications</p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
