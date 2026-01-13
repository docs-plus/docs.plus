const SidebarLoader = () => {
  return (
    <div className="flex h-full w-64 flex-col border-l border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 p-4">
        <div className="skeleton h-5 w-36 rounded" />
        <div className="skeleton mt-2 h-3 w-24 rounded" />
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {[1, 2, 3].map((day) => (
          <div key={day} className="border-b border-slate-100">
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton size-4 rounded" />
            </div>

            {/* Session items */}
            <div className="space-y-1 pb-3">
              {[1, 2].map((session) => (
                <div key={session} className="flex items-start gap-3 px-4 py-2">
                  {/* Timeline dot */}
                  <div className="pt-1.5">
                    <div className="skeleton size-2 rounded-full" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="skeleton h-4 w-20 rounded" />
                      {session === 1 && day === 1 && (
                        <div className="skeleton bg-primary/20 h-4 w-12 rounded" />
                      )}
                    </div>
                    <div className="skeleton h-3 w-16 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SidebarLoader
