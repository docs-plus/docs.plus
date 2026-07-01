export function UserProfileDialogHeaderSkeleton() {
  return (
    <>
      <div className="skeleton size-14 shrink-0 rounded-full sm:size-16" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="skeleton rounded-field h-5 w-40 max-w-full sm:h-6 sm:w-48" />
        <div className="skeleton rounded-field h-3.5 w-28 max-w-full" />
      </div>
    </>
  )
}

export function UserProfileDialogSkeleton() {
  return (
    <div
      className="space-y-6 p-4 motion-safe:animate-[doc-content-in_120ms_ease-out_both] sm:p-6"
      aria-hidden>
      <div className="space-y-3">
        <div className="skeleton rounded-field h-3 w-14" />
        <div className="space-y-2">
          <div className="skeleton rounded-field h-3.5 w-full" />
          <div className="skeleton rounded-field h-3.5 w-[92%]" />
          <div className="skeleton rounded-field h-3.5 w-[78%]" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="skeleton rounded-field h-3 w-12" />
        <div className="flex flex-col gap-2">
          <div className="bg-base-200/80 flex items-center gap-3 rounded-xl p-3">
            <div className="skeleton size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton rounded-field h-3.5 w-32" />
              <div className="skeleton rounded-field h-3 w-24" />
            </div>
          </div>
          <div className="bg-base-200/80 flex items-center gap-3 rounded-xl p-3">
            <div className="skeleton size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="skeleton rounded-field h-3.5 w-28" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
