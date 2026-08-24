/** Chips/mode only appear with active filters, which never exist on first paint. */
export const FilterSkeleton = () => {
  return (
    <div className="bg-base-100 flex w-full flex-col">
      <div className="flex items-center justify-between px-3 pt-2.5">
        <div className="skeleton h-4 w-12 rounded" />
        <div className="skeleton size-6 rounded" />
      </div>
      <div className="px-3 pt-1 pb-3">
        <div className="skeleton rounded-field h-10 w-full" />
      </div>
    </div>
  )
}

export default FilterSkeleton
