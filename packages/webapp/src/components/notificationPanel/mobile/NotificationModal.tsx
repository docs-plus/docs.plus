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

const NotificationModal = () => {
  const { loadingNotification, notifications, notificationActiveTab } = useStore((state) => state)

  useNotificationSummary()
  useNotificationTabData()

  const activeTabNotifList = useMemo(() => {
    return notifications.get(notificationActiveTab) || []
  }, [notifications, notificationActiveTab])

  return (
    <div className="h-full overflow-hidden p-3">
      <NotificationHeader />
      <div className="mt-4" style={{ height: 'calc(100% - 56px)' }}>
        <NotificationFilters />
        <div
          className="mt-2 flex h-[93%] flex-col overflow-auto border-t-2 border-b-2 border-gray-300 pb-3"
          style={{ height: 'calc(100% - 30px)' }}>
          <LoadingSpinner show={loadingNotification} />
          <EmptyNotificationState show={!loadingNotification && activeTabNotifList.length === 0} />

          {activeTabNotifList.map((notification, index) => (
            <NotificationItem key={index} notification={notification} />
          ))}

          {activeTabNotifList.length > 0 && <LoadMoreButton />}
        </div>
      </div>
    </div>
  )
}

export default NotificationModal
