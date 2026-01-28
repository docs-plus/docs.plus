/**
 * Skeleton loader for the FilterModal when dynamically loaded.
 * Matches the visual structure of the actual panel.
 */

export const FilterPanelSkeleton = () => {
  return (
    <div className="bg-base-100 flex w-full flex-col">
      {/* Header skeleton */}
      <div className="border-base-300 flex items-center justify-between border-b px-4 py-3">
        <div className="skeleton h-6 w-16 rounded" />
        <div className="skeleton h-7 w-7 rounded" />
      </div>

      {/* Content skeleton */}
      <div className="flex flex-col gap-4 p-4">
        {/* Search input skeleton */}
        <div className="skeleton h-10 w-full rounded-lg" />

        {/* Active filters section skeleton */}
        <div className="rounded-box border-base-300 border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="skeleton h-4 w-4 rounded" />
              <div className="skeleton h-4 w-24 rounded" />
            </div>
            <div className="skeleton h-6 w-14 rounded" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="skeleton h-6 w-20 rounded-full" />
            <div className="skeleton h-6 w-24 rounded-full" />
            <div className="skeleton h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="border-base-300 bg-base-200/50 flex items-center gap-3 border-t px-4 py-3">
        <div className="skeleton h-10 flex-1 rounded-lg" />
        <div className="skeleton h-10 flex-[2] rounded-lg" />
      </div>
    </div>
  )
}

export default FilterPanelSkeleton
