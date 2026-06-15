/**
 * Skeleton loader for DocumentSettingsPanel when dynamically loaded.
 * Matches the visual structure of the actual panel.
 */

const AccordionSkeleton = () => (
  <div className="rounded-box border-base-300 border p-4">
    <div className="flex items-center gap-2">
      <div className="skeleton size-4 rounded" />
      <div className="skeleton h-5 w-32 rounded" />
    </div>
  </div>
)

export const DocumentSettingsSkeleton = () => {
  return (
    <div className="bg-base-100 flex w-full flex-col">
      {/* Header skeleton */}
      <div className="border-base-300 flex items-center justify-between border-b px-4 py-3">
        <div className="skeleton h-6 w-20 rounded" />
        <div className="skeleton size-7 rounded" />
      </div>

      {/* Content skeleton */}
      <div className="flex flex-col gap-4 p-4">
        {/* Document Preferences accordion skeleton */}
        <AccordionSkeleton />

        {/* Document Preferences accordion skeleton */}
        <div className="rounded-box border-base-300 border p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="skeleton size-4 rounded" />
            <div className="skeleton h-5 w-40 rounded" />
          </div>
          {/* Textarea skeleton */}
          <div className="skeleton rounded-field mb-4 h-20 w-full" />
          {/* Tags skeleton */}
          <div className="skeleton rounded-field mb-4 h-10 w-full" />
          {/* Button skeleton */}
          <div className="flex justify-end">
            <div className="skeleton rounded-field h-10 w-28" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentSettingsSkeleton
