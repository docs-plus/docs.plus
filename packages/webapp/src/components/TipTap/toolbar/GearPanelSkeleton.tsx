/**
 * Skeleton loader for the GearModal when dynamically loaded.
 * Matches the visual structure of the actual panel.
 */

const AccordionSkeleton = () => (
  <div className="rounded-box border-base-300 border p-4">
    <div className="flex items-center gap-2">
      <div className="skeleton h-4 w-4 rounded" />
      <div className="skeleton h-5 w-32 rounded" />
    </div>
  </div>
)

export const GearPanelSkeleton = () => {
  return (
    <div className="bg-base-100 flex w-full flex-col">
      {/* Header skeleton */}
      <div className="border-base-300 flex items-center justify-between border-b px-4 py-3">
        <div className="skeleton h-6 w-20 rounded" />
        <div className="skeleton h-7 w-7 rounded" />
      </div>

      {/* Content skeleton */}
      <div className="flex flex-col gap-4 p-4">
        {/* Page Preferences accordion skeleton */}
        <AccordionSkeleton />

        {/* Document Preferences accordion skeleton */}
        <div className="rounded-box border-base-300 border p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="skeleton h-4 w-4 rounded" />
            <div className="skeleton h-5 w-40 rounded" />
          </div>
          {/* Textarea skeleton */}
          <div className="skeleton mb-4 h-20 w-full rounded-lg" />
          {/* Tags skeleton */}
          <div className="skeleton mb-4 h-10 w-full rounded-lg" />
          {/* Button skeleton */}
          <div className="flex justify-end">
            <div className="skeleton h-10 w-28 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default GearPanelSkeleton
