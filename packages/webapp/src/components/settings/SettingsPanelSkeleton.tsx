const SettingsPanelSkeleton = () => (
  <div className="bg-base-100 flex min-h-0 flex-1 flex-col overflow-hidden md:h-[min(85vh,800px)] md:flex-none md:flex-row">
    {/* ── Sidebar skeleton ── */}
    <aside className="border-base-300 flex min-h-0 w-full flex-1 flex-col md:w-72 md:flex-none md:shrink-0 md:border-r lg:w-80">
      {/* Mobile header */}
      <div className="border-base-300 flex items-center justify-between border-b p-4 md:hidden">
        <div className="skeleton rounded-field h-5 w-20" />
        <div className="skeleton size-8 rounded-full" />
      </div>

      {/* Scrollable area */}
      <div className="flex-1 space-y-4 overflow-hidden p-4 sm:p-6">
        {/* Avatar card */}
        <div className="bg-base-200 rounded-box flex items-center gap-2.5 p-2.5">
          <div className="skeleton size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="skeleton rounded-field h-4 w-28" />
            <div className="skeleton rounded-field h-3 w-36" />
          </div>
        </div>

        {/* Section label */}
        <div className="skeleton rounded-field ml-2 h-3 w-14" />

        {/* 4 nav items */}
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`rounded-field flex min-h-[44px] items-center gap-2.5 px-3 ${
                i === 1 ? 'bg-primary/10' : ''
              }`}>
              <div className="skeleton size-[18px] shrink-0 rounded" />
              <div
                className="skeleton rounded-field h-4"
                style={{ width: [72, 88, 64, 96][i - 1] }}
              />
              <div className="skeleton ml-auto size-[18px] shrink-0 rounded md:hidden" />
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-base-300 border-t" />

        {/* Section label */}
        <div className="skeleton rounded-field ml-2 h-3 w-20" />

        {/* 3 support links */}
        <div className="space-y-0.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-field flex min-h-[44px] items-center gap-2.5 px-2">
              <div className="skeleton size-4 shrink-0 rounded" />
              <div
                className="skeleton rounded-field h-4"
                style={{ width: [112, 120, 96][i - 1] }}
              />
              <div className="skeleton ml-auto size-3.5 shrink-0 rounded" />
            </div>
          ))}
        </div>

        {/* GitHub button */}
        <div className="skeleton rounded-field h-[44px] w-full" />
      </div>

      {/* Sign-out button */}
      <div className="border-base-300 mt-auto shrink-0 border-t p-4 sm:px-6">
        <div className="skeleton rounded-field h-10 w-full" />
      </div>
    </aside>

    {/* ── Content area skeleton (desktop only) ── */}
    <div className="hidden min-h-0 flex-1 flex-col md:flex">
      {/* Content header */}
      <div className="border-base-300 flex shrink-0 items-center gap-2 border-b px-4 py-3">
        <div className="skeleton rounded-field h-5 w-16" />
        <div className="skeleton ml-auto size-8 rounded-full" />
      </div>

      {/* Content body — default "Profile" skeleton */}
      <div className="bg-base-200 flex-1 overflow-hidden">
        <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
          {/* Avatar + name card */}
          <div className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
            <div className="flex items-center gap-5">
              <div className="skeleton rounded-box size-24 shrink-0" />
              <div className="flex flex-col gap-2">
                <div className="skeleton rounded-field h-5 w-32" />
                <div className="skeleton rounded-field h-4 w-24" />
                <div className="skeleton rounded-field h-8 w-20" />
              </div>
            </div>
          </div>

          {/* Form fields card */}
          <div className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
            <div className="skeleton rounded-field mb-4 h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="skeleton rounded-field h-11 w-full" />
              <div className="skeleton rounded-field h-11 w-full" />
            </div>
            <div className="skeleton rounded-field mt-4 h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  </div>
)

export default SettingsPanelSkeleton
