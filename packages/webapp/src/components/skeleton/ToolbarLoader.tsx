const ToolbarSkeleton = () => {
  return (
    <div className="tiptap__toolbar flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
      {/* Text formatting dropdown */}
      <div className="skeleton h-6 w-24 rounded" />

      <div className="h-5 w-px bg-slate-200" />

      {/* Formatting buttons */}
      <div className="flex gap-1">
        <div className="skeleton size-7 rounded" />
        <div className="skeleton size-7 rounded" />
        <div className="skeleton size-7 rounded" />
      </div>

      <div className="h-5 w-px bg-slate-200" />

      {/* More buttons */}
      <div className="flex gap-1">
        <div className="skeleton size-7 rounded" />
        <div className="skeleton size-7 rounded" />
        <div className="skeleton size-7 rounded" />
      </div>

      {/* Right side actions */}
      <div className="ml-auto flex gap-2">
        <div className="skeleton size-7 rounded" />
        <div className="h-5 w-px bg-slate-200" />
        <div className="skeleton size-7 rounded" />
        <div className="skeleton size-7 rounded" />
      </div>
    </div>
  )
}

export default ToolbarSkeleton
