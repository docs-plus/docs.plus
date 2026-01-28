/**
 * Skeleton loader for the NotificationPanel when dynamically loaded.
 * Matches the visual structure of the actual panel.
 */

const NotificationItemSkeleton = () => (
  <div className="rounded-box border-base-300 bg-base-100 flex w-full items-start gap-3 border p-3">
    <div className="skeleton size-9 shrink-0 rounded-full" />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <div className="skeleton h-3 w-3 rounded" />
        <div className="skeleton h-4 w-28 rounded" />
      </div>
      <div className="mt-2">
        <div className="skeleton h-8 w-full rounded-lg" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-5 w-20 rounded" />
        <div className="skeleton ml-auto h-6 w-12 rounded" />
      </div>
    </div>
  </div>
)

export const NotificationPanelSkeleton = () => {
  return (
    <div className="bg-base-100 flex w-full flex-col">
      {/* Header skeleton */}
      <div className="border-base-300 flex items-center justify-between border-b px-4 py-3">
        <div className="skeleton h-6 w-28 rounded" />
        <div className="flex items-center gap-2">
          <div className="skeleton h-7 w-24 rounded" />
          <div className="skeleton h-7 w-7 rounded" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="border-base-300 flex gap-2 border-b px-4 py-2">
        <div className="skeleton h-8 w-20 rounded-lg" />
        <div className="skeleton h-8 w-24 rounded-lg" />
        <div className="skeleton h-8 w-16 rounded-lg" />
      </div>

      {/* Content skeleton */}
      <div className="flex flex-col gap-2 p-3">
        <NotificationItemSkeleton />
        <NotificationItemSkeleton />
        <NotificationItemSkeleton />
        <NotificationItemSkeleton />
      </div>
    </div>
  )
}

export default NotificationPanelSkeleton
