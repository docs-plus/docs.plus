import { PanelFeedSkeleton } from '@components/PanelFeedItem'

type PanelSurfaceSkeletonProps = {
  tabCount: number
  /** Width of the title bone, sized to the real title. */
  titleWidthClassName?: string
  /** Mirrors a header action before the close button (Notifications: Mark all read). */
  headerAction?: boolean
  typeIcon?: boolean
  count?: number
}

/** The popover `PanelSurfaceShell` while its chunk loads: header, tab track, then feed bones. */
export function PanelSurfaceSkeleton({
  tabCount,
  titleWidthClassName = 'w-24',
  headerAction = false,
  typeIcon = false,
  count = 3
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
      <div className="px-4 py-2.5">
        <div className="bg-base-300 rounded-box flex p-1">
          {Array.from({ length: tabCount }, (_, index) => (
            <div
              key={index}
              className={
                index === 0 ? 'bg-base-100 rounded-field min-h-9 flex-1' : 'min-h-9 flex-1'
              }
            />
          ))}
        </div>
      </div>
      <div className="p-3">
        <PanelFeedSkeleton count={count} typeIcon={typeIcon} />
      </div>
    </div>
  )
}
