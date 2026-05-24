import { PanelTabBar } from '@components/ui/PanelTabBar'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'
import { type PanelSurfaceVariant, TTab } from '@types'
import { twMerge } from 'tailwind-merge'

import { EmptyNotificationState } from '../components/EmptyNotificationState'
import { NotificationHeader } from '../components/NotificationHeader'
import { NotificationItem } from '../components/NotificationItem'
import { NotificationSkeleton } from '../components/NotificationSkeleton'
import { useInfiniteNotifications } from '../hooks/useInfiniteNotifications'
import { useNotificationSummary } from '../hooks/useNotificationSummary'

interface NotificationPanelProps {
  onClose?: () => void
  variant?: PanelSurfaceVariant
}

export const NotificationPanel = ({ onClose, variant = 'popover' }: NotificationPanelProps) => {
  const notificationActiveTab = useStore((state) => state.notificationActiveTab)
  const notificationTabs = useStore((state) => state.notificationTabs)
  const setNotificationActiveTab = useStore((state) => state.setNotificationActiveTab)
  const isSheet = variant === 'sheet'

  useNotificationSummary()

  const { notifications, isLoading, isLoadingMore, hasMore, sentinelRef } =
    useInfiniteNotifications()

  return (
    <div
      className={twMerge(
        'bg-base-100 flex min-h-0 w-full flex-col overflow-hidden',
        isSheet && 'h-full flex-1'
      )}>
      <div className="border-base-300 shrink-0 border-b px-4 py-3">
        <NotificationHeader onClose={onClose} showClose={!isSheet} />
      </div>

      <PanelTabBar<TTab>
        tabs={notificationTabs}
        activeTab={notificationActiveTab}
        onSelect={setNotificationActiveTab}
      />

      <ScrollArea
        className={twMerge('p-3', isSheet ? 'min-h-0 flex-1' : 'max-h-96 min-h-48')}
        scrollbarSize="thin"
        hideScrollbar
        preserveWidth={false}>
        {isLoading && notifications.length === 0 && (
          <NotificationSkeleton count={isSheet ? 5 : 4} />
        )}

        <EmptyNotificationState show={!isLoading && notifications.length === 0} />

        {notifications.length > 0 && (
          <div className="flex flex-col gap-2">
            {notifications.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} />
            ))}

            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-3">
                {isLoadingMore && (
                  <div className="loading loading-spinner loading-sm text-primary" />
                )}
              </div>
            )}

            {!hasMore && notifications.length > 0 && (
              <p className="text-base-content/40 py-3 text-center text-xs">No more notifications</p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
