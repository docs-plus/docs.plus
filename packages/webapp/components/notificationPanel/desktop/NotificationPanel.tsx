import { useMemo } from 'react'
import { useStore } from '@stores'
import NotificationFilters from '../components/NotificationFilters'
import { EmptyNotificationState } from '../components/EmptyNotificationState'
import { NotificationItem } from '../components/NotificationItem'
import { NotificationHeader } from '../components/NotificationHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useNotificationSummary } from '../hooks/useNotificationSummary'
import { LoadMoreButton } from '../components/LoadMoreButton'
import { useNotificationTabData } from '../hooks/useNotificationTabData'

export const NotificationPanel = () => {
  const { loadingNotification, notifications, notificationActiveTab } = useStore((state) => state)

  useNotificationSummary()
  useNotificationTabData()

  const activeTabNotifList = useMemo(() => {
    return notifications.get(notificationActiveTab) || []
  }, [notifications, notificationActiveTab])

  return (
    <div className="w-full min-w-96 p-3 pb-0">
      <NotificationHeader />
      <div className="mt-4">
        <NotificationFilters />
        <div className="divider m-0 p-0"></div>
        <div className="max-h-96 overflow-hidden overflow-y-auto">
          <LoadingSpinner show={loadingNotification} />
          <EmptyNotificationState show={!loadingNotification && activeTabNotifList.length === 0} />

          <div className={`flex-col gap-2`}>
            {activeTabNotifList.map((notification, index) => (
              <NotificationItem key={index} notification={notification} />
            ))}

            {activeTabNotifList.length > 0 && <LoadMoreButton />}
          </div>
        </div>
      </div>
    </div>
  )
}
