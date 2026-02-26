const ToolbarSkeleton = () => {
  return (
    <div className="tiptap__toolbar border-base-300 bg-base-100 flex items-center gap-2 border-b px-4 py-2">
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
