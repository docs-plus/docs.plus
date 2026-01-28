/**
 * Skeleton loader for notification items.
 * Uses daisyUI skeleton class for consistent loading states.
 */

interface NotificationSkeletonProps {
  /** Number of skeleton items to show */
  count?: number
}

const NotificationSkeletonItem = () => (
  <div className="rounded-box border-base-300 bg-base-100 flex w-full items-start gap-3 border p-3">
    {/* Avatar skeleton */}
    <div className="skeleton size-9 shrink-0 rounded-full" />

    <div className="min-w-0 flex-1">
      {/* Name and icon row */}
      <div className="flex items-center gap-2">
        <div className="skeleton h-3 w-3 rounded" />
        <div className="skeleton h-4 w-28 rounded" />
      </div>

      {/* Message preview skeleton */}
      <div className="mt-2">
        <div className="skeleton h-8 w-full rounded-lg" />
      </div>

      {/* Footer row */}
      <div className="mt-2 flex items-center gap-2">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-5 w-20 rounded" />
        <div className="skeleton ml-auto h-6 w-12 rounded" />
      </div>
    </div>
  </div>
)

export const NotificationSkeleton = ({ count = 3 }: NotificationSkeletonProps) => {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <NotificationSkeletonItem key={index} />
      ))}
    </div>
  )
}
