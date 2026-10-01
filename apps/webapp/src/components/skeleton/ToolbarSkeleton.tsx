import ToolbarDivider from '@components/TipTap/toolbar/ToolbarDivider'

const ToolbarSkeleton = () => {
  return (
    <div className="tiptap__toolbar border-base-300 bg-base-100 flex min-w-0 items-center gap-2 border-b px-3 py-1.5">
      {/* Text formatting dropdown */}
      <div className="skeleton rounded-field h-8 w-40" />

      <ToolbarDivider className="mx-0" />

      {/* Formatting buttons */}
      <div className="flex gap-1">
        <div className="skeleton rounded-field size-8" />
        <div className="skeleton rounded-field size-8" />
        <div className="skeleton rounded-field size-8" />
      </div>

      <ToolbarDivider className="mx-0" />

      {/* More buttons */}
      <div className="flex gap-1">
        <div className="skeleton rounded-field size-8" />
        <div className="skeleton rounded-field size-8" />
        <div className="skeleton rounded-field size-8" />
      </div>

      {/* Right side actions */}
      <div className="ml-auto flex gap-2">
        <div className="skeleton rounded-field size-8" />
        <ToolbarDivider className="mx-0" />
        <div className="skeleton rounded-field size-8" />
        <div className="skeleton rounded-field size-8" />
      </div>
    </div>
  )
}

export default ToolbarSkeleton
