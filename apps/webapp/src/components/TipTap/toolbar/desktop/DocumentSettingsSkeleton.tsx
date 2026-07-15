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
      <div className="border-base-300 flex items-center justify-between border-b px-4 py-3">
        <div className="skeleton h-6 w-20 rounded" />
        <div className="skeleton size-7 rounded" />
      </div>

      <div className="bg-base-200 border-base-300 flex flex-col border-b px-4 py-3">
        <div className="mb-3 flex items-center gap-3">
          <div className="skeleton size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="skeleton h-2.5 w-14 rounded" />
            <div className="skeleton h-4 w-28 rounded" />
          </div>
        </div>
        <div className="border-base-300 space-y-3 border-t pt-3">
          <div className="flex items-center justify-between gap-4">
            <div className="skeleton h-8 w-40 rounded" />
            <div className="skeleton h-5 w-9 rounded-full" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="skeleton h-8 w-44 rounded" />
            <div className="skeleton h-5 w-9 rounded-full" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <AccordionSkeleton />
        <AccordionSkeleton />
      </div>
    </div>
  )
}

export default DocumentSettingsSkeleton
