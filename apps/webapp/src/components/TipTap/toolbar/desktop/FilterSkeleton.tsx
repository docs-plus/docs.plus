import { PanelSurfaceSkeleton } from '@components/PanelSurfaceSkeleton'

/** Chips/mode only appear with active filters, which never exist on first paint. */
export const FilterSkeleton = () => {
  return (
    <PanelSurfaceSkeleton titleWidthClassName="w-12">
      <div className="p-3">
        <div className="skeleton rounded-field h-10 w-full" />
      </div>
    </PanelSurfaceSkeleton>
  )
}

export default FilterSkeleton
