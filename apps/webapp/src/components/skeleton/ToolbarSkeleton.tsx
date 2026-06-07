const ToolbarSkeleton = () => {
  return (
    <div className="tiptap__toolbar border-base-300 bg-base-100 flex min-w-0 items-center gap-2 border-b px-3 py-1.5">
      {/* Text formatting dropdown */}
      <div className="skeleton h-6 w-24 rounded" />

      <div className="bg-base-300 h-5 w-px" />

      {/* Formatting buttons */}
      <div className="flex gap-1">
        <div className="skeleton size-7 rounded" />
        <div className="skeleton size-7 rounded" />
        <div className="skeleton size-7 rounded" />
      </div>

      <div className="bg-base-300 h-5 w-px" />

      {/* More buttons */}
      <div className="flex gap-1">
        <div className="skeleton size-7 rounded" />
        <div className="skeleton size-7 rounded" />
        <div className="skeleton size-7 rounded" />
      </div>

      {/* Right side actions */}
      <div className="ml-auto flex gap-2">
        <div className="skeleton size-7 rounded" />
        <div className="bg-base-300 h-5 w-px" />
        <div className="skeleton size-7 rounded" />
        <div className="skeleton size-7 rounded" />
      </div>
    </div>
  )
}

export default ToolbarSkeleton
