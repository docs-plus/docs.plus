import { PanelFeedSkeleton } from '@components/PanelFeedItem'
import type { ReactNode } from 'react'

/** A `skeleton` bone does not show on the `base-300` track, so the first pill is a static `base-100` fill. */
export function PanelTabBarSkeleton({ tabCount }: { tabCount: number }) {
  return (
    <div className="shrink-0 px-4 py-2.5">
      <div className="bg-base-300 rounded-box flex p-1">
        {Array.from({ length: tabCount }, (_, index) => (
          <div
            key={index}
            className={index === 0 ? 'bg-base-100 rounded-field min-h-9 flex-1' : 'min-h-9 flex-1'}
          />
        ))}
      </div>
    </div>
  )
}

type PanelSurfaceSkeletonProps = {
  /** No tab track when absent. */
  tabCount?: number
  /** Width of the title bone, sized to the real title. */
  titleWidthClassName?: string
  /** Mirrors a header action before the close button (Notifications: Mark all read). */
  headerAction?: boolean
  typeIcon?: boolean
  count?: number
  /** Replaces the default feed body, so `count` and `typeIcon` then do nothing. */
  children?: ReactNode
}

/** The popover `PanelSurfaceShell` while its chunk loads: header, tab track, then body bones. */
export function PanelSurfaceSkeleton({
  tabCount,
  titleWidthClassName = 'w-24',
  headerAction = false,
  typeIcon = false,
  count = 3,
  children
}: PanelSurfaceSkeletonProps) {
  return (
    <div className="bg-base-100 flex w-full flex-col" aria-hidden>
      <div className="border-base-300 flex items-center justify-between border-b px-4 py-3">
        <div className={`skeleton h-5 ${titleWidthClassName}`} />
        <div className="flex items-center gap-1">
          {headerAction && <div className="skeleton h-4 w-24" />}
          <div className="skeleton rounded-field size-8" />
        </div>
      </div>
      {tabCount != null && <PanelTabBarSkeleton tabCount={tabCount} />}
      {children ?? (
        <div className="p-3">
          <PanelFeedSkeleton count={count} typeIcon={typeIcon} />
        </div>
      )}
    </div>
  )
}
