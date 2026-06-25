import { PanelPopoverHeader } from '@components/PanelPopoverHeader'
import { PanelSurfaceShell } from '@components/PanelSurfaceShell'
import { TabbedPanelBody } from '@components/TabbedPanelBody'
import { useStore } from '@stores'
import { type PanelSurfaceVariant } from '@types'

import { EmptyNotificationState } from '../components/EmptyNotificationState'
import { NotificationItem } from '../components/NotificationItem'
import { NotificationMarkAllReadButton } from '../components/NotificationMarkAllReadButton'
import { NotificationSkeleton } from '../components/NotificationSkeleton'
import { useNotificationPanelFeed } from '../feed/useNotificationPanelFeed'

interface NotificationPanelProps {
  onClose?: () => void
  variant?: PanelSurfaceVariant
}

export const NotificationPanel = ({ onClose, variant = 'popover' }: NotificationPanelProps) => {
  const notificationActiveTab = useStore((state) => state.notificationActiveTab)
  const notificationTabs = useStore((state) => state.notificationTabs)
  const setNotificationActiveTab = useStore((state) => state.setNotificationActiveTab)
  const isSheet = variant === 'sheet'
  const markAllReadAction = <NotificationMarkAllReadButton />

  const { notifications, isLoading, isLoadingMore, hasMore, sentinelRef } =
    useNotificationPanelFeed()

  return (
    <PanelSurfaceShell
      variant={variant}
      title="Notifications"
      fillHeight
      bodyClassName="min-h-0 overflow-hidden"
      headerActions={markAllReadAction}
      popoverHeader={
        <PanelPopoverHeader
          title="Notifications"
          onClose={onClose}
          showClose
          actions={markAllReadAction}
        />
      }>
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
        renderItem={(notification) => (
          <NotificationItem notification={notification} variant={variant} />
        )}
        loadingSkeleton={<NotificationSkeleton count={isSheet ? 5 : 4} />}
        emptyState={<EmptyNotificationState show={!isLoading && notifications.length === 0} />}
        endMessage="No more notifications"
      />
    </PanelSurfaceShell>
  )
}
