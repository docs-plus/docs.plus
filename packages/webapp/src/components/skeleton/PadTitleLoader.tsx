export const PadTitleLoader = () => {
  return (
    <div className="docTitle flex min-h-14 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
      {/* Left side - Logo and title */}
      <div className="flex items-center gap-3">
        <div className="skeleton hidden size-8 rounded md:block" />
        <div className="skeleton h-5 w-32 rounded" />
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-3">
        <div className="skeleton hidden h-8 w-20 rounded-lg md:block" />
        <div className="skeleton size-9 rounded-full" />
      </div>
    </div>
  )
}
