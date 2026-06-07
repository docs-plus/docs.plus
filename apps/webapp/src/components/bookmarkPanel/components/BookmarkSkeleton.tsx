/**
 * Skeleton loader for bookmark items.
 * Uses daisyUI skeleton class for consistent loading states.
 */

interface BookmarkSkeletonProps {
  /** Number of skeleton items to show */
  count?: number
}

const BookmarkSkeletonItem = () => (
  <div className="rounded-box border-base-300 bg-base-100 flex w-full items-start gap-3 border p-3">
    {/* Avatar skeleton */}
    <div className="skeleton size-10 shrink-0 rounded-full" />

    <div className="min-w-0 flex-1">
      {/* Name row */}
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-6 w-6 rounded" />
      </div>

      {/* Message content skeleton */}
      <div className="mt-2">
        <div className="skeleton h-10 w-full rounded-lg" />
      </div>

      {/* Footer row */}
      <div className="mt-2 flex items-center justify-between">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="flex gap-1">
          <div className="skeleton h-7 w-7 rounded" />
          <div className="skeleton h-7 w-7 rounded" />
          <div className="skeleton h-7 w-7 rounded" />
        </div>
      </div>
    </div>
  </div>
)

export const BookmarkSkeleton = ({ count = 3 }: BookmarkSkeletonProps) => {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <BookmarkSkeletonItem key={index} />
      ))}
    </div>
  )
}
