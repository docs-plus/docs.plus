import { PanelSurfaceSkeleton } from '@components/PanelSurfaceSkeleton'

const AccordionSkeleton = () => (
  <div className="rounded-box border-base-300 border p-4">
    <div className="flex items-center gap-2">
      <div className="skeleton size-4" />
      <div className="skeleton h-5 w-32" />
    </div>
  </div>
)

// Each real row is a `ToggleRow`: a `text-sm` label over a help line.
const ToggleRowSkeleton = () => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex flex-col gap-1">
      <div className="skeleton h-3.5 w-16" />
      <div className="skeleton h-3 w-44" />
    </div>
    <div className="skeleton h-5 w-9 rounded-full" />
  </div>
)

export const DocumentSettingsSkeleton = () => {
  return (
    <PanelSurfaceSkeleton titleWidthClassName="w-36">
      <div className="bg-base-200 border-base-300 flex flex-col border-b px-4 py-3">
        <div className="mb-3 flex items-center gap-3">
          <div className="skeleton size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="skeleton h-2.5 w-14" />
            <div className="skeleton h-4 w-28" />
          </div>
        </div>
        <div className="border-base-300 space-y-3 border-t pt-3">
          <ToggleRowSkeleton />
          <ToggleRowSkeleton />
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <AccordionSkeleton />
        <AccordionSkeleton />
      </div>
    </PanelSurfaceSkeleton>
  )
}

export default DocumentSettingsSkeleton
