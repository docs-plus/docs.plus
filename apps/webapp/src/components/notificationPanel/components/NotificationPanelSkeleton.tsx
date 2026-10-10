import { PanelSurfaceSkeleton } from '@components/PanelSurfaceSkeleton'
import { useStore } from '@stores'
import { LuCheckCheck } from 'react-icons/lu'

import { unreadCountOf } from '../utils/unreadCountOf'

/** The panel shows Mark all read only while Unread is above 0, so the loader reads the same count. */
export const NotificationPanelSkeleton = () => {
  const hasUnread = useStore((state) => unreadCountOf(state.notificationTabs) > 0)
  return (
    <PanelSurfaceSkeleton
      tabCount={3}
      titleWidthClassName="w-28"
      headerActions={
        hasUnread ? (
          <div className="flex h-5 items-center gap-1.5 text-[var(--primary-ink)]">
            <LuCheckCheck size={14} />
            <div className="skeleton h-3.5 w-20" />
          </div>
        ) : null
      }
      typeIcon
      count={4}
    />
  )
}
