import { twMerge } from '@utils/twMerge'

/**
 * A `skeleton` bone does not show on the `base-300` track, so the first pill is a static
 * `base-100` fill. `className` goes to the wrapper, as on the real `PanelTabBar`.
 */
export function PanelTabBarSkeleton({
  tabCount,
  className
}: {
  tabCount: number
  className?: string
}) {
  return (
    <div className={twMerge('shrink-0 px-4 py-2.5', className)}>
      <div className="bg-base-300 rounded-box flex p-1">
        {Array.from({ length: tabCount }, (_, index) => (
          <div
            key={index}
            className={
              index === 0 ? 'bg-base-100 rounded-field min-h-9 flex-1 shadow-sm' : 'min-h-9 flex-1'
            }
          />
        ))}
      </div>
    </div>
  )
}
