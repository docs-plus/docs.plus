/** Body bones for HistorySidebar. The sidebar renders them inside its real frame and header. */
const SidebarLoader = ({ tabs = false }: { tabs?: boolean }) => {
  return (
    <div aria-hidden className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Mirrors the PanelTabBar track, so the tabs do not jump when they load. */}
      {tabs && (
        <div className="shrink-0 px-4 py-2.5">
          <div className="bg-base-300 rounded-box flex gap-1 p-1">
            <div className="skeleton rounded-field h-9 flex-1" />
            <div className="skeleton rounded-field h-9 flex-1" />
          </div>
        </div>
      )}

      {[1, 2, 3].map((day) => (
        <div key={day}>
          <div className="border-base-300 border-b">
            <div className="flex min-h-10 items-center justify-between px-3 py-2">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton size-4" />
            </div>
          </div>

          {[1, 2].map((session) => (
            <div key={session} className="px-3 py-1">
              <div className="rounded-box border-base-300 bg-base-100 flex min-h-11 items-center gap-2.5 border px-3 py-2.5">
                <div className="skeleton rounded-field size-5 shrink-0" />
                {/* Line boxes match the real 20px time and 16px meta lines. */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex h-5 items-center">
                    <div className="skeleton h-4 w-24" />
                  </div>
                  <div className="flex h-4 items-center">
                    <div className="skeleton h-3 w-16" />
                  </div>
                </div>
                <div className="skeleton size-6 shrink-0 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default SidebarLoader
