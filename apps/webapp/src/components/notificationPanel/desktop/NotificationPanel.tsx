import { PanelFeedSkeleton } from '@components/PanelFeedItem'
import { PanelSurfaceShell } from '@components/PanelSurfaceShell'
import { TabbedPanelBody } from '@components/TabbedPanelBody'
import { EmptyState } from '@components/ui/EmptyState'
import { useStore } from '@stores'
import { type PanelSurfaceVariant } from '@types'
import { LuInbox } from 'react-icons/lu'

import { NotificationItem } from '../components/NotificationItem'
import { NotificationMarkAllReadButton } from '../components/NotificationMarkAllReadButton'
import { useNotificationPanelFeed } from '../feed/useNotificationPanelFeed'

interface NotificationPanelProps {
  variant?: PanelSurfaceVariant
}

export const NotificationPanel = ({ variant = 'popover' }: NotificationPanelProps) => {
  const notificationActiveTab = useStore((state) => state.notificationActiveTab)
  const notificationTabs = useStore((state) => state.notificationTabs)
  const setNotificationActiveTab = useStore((state) => state.setNotificationActiveTab)
  const isSheet = variant === 'sheet'
  const unreadCount = notificationTabs.find((tab) => tab.label === 'Unread')?.count ?? 0

  const { notifications, isLoading, isLoadingMore, hasMore, isError, retry, sentinelRef } =
    useNotificationPanelFeed()

  return (
    <PanelSurfaceShell
      variant={variant}
      title="Notifications"
      fillHeight
      bodyClassName="min-h-0 overflow-hidden"
      headerActions={unreadCount > 0 ? <NotificationMarkAllReadButton /> : null}>
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
        loadingSkeleton={<PanelFeedSkeleton count={isSheet ? 5 : 4} typeIcon />}
        emptyState={
          <EmptyState
            icon={LuInbox}
            title="You’re all caught up."
            body="New notifications will appear here."
          />
        }
        isError={isError}
        errorState={
          <EmptyState tone="error" title="Couldn’t load notifications." onRetry={retry} />
        }
      />
    </PanelSurfaceShell>
  )
}
