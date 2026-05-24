import { PanelSurfaceShell } from '@components/PanelSurfaceShell'
import { TabbedPanelBody } from '@components/TabbedPanelBody'
import { useStore } from '@stores'
import { type PanelSurfaceVariant } from '@types'

import { EmptyNotificationState } from '../components/EmptyNotificationState'
import { NotificationHeader } from '../components/NotificationHeader'
import { NotificationItem } from '../components/NotificationItem'
import { NotificationMarkAllReadButton } from '../components/NotificationMarkAllReadButton'
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
    <PanelSurfaceShell
      variant={variant}
      title="Notifications"
      fillHeight
      bodyClassName="min-h-0 overflow-hidden"
      headerActions={<NotificationMarkAllReadButton />}
      popoverHeader={<NotificationHeader onClose={onClose} showClose />}>
      <TabbedPanelBody
        variant={variant}
        tabs={notificationTabs}
        activeTab={notificationActiveTab}
        onSelect={setNotificationActiveTab}
        items={notifications}
        getItemKey={(notification) => notification.id}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        sentinelRef={sentinelRef}
        renderItem={(notification) => <NotificationItem notification={notification} />}
        loadingSkeleton={<NotificationSkeleton count={isSheet ? 5 : 4} />}
        emptyState={<EmptyNotificationState show={!isLoading && notifications.length === 0} />}
        endMessage="No more notifications"
      />
    </PanelSurfaceShell>
  )
}
