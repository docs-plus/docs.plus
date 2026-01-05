const SidebarLoader = () => {
  return (
    <div className="sidebar flex h-full w-[25%] flex-col border-l border-gray-200 bg-base-100">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="skeleton h-6 w-36" />
        <div className="skeleton mt-2 h-3 w-24" />
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {/* Day groups */}
        {[1, 2, 3].map((day) => (
          <div key={day} className="border-b border-gray-100">
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-4" />
            </div>

            {/* Session items */}
            <div className="pb-2">
              {[1, 2].map((session) => (
                <div key={session} className="flex items-start gap-3 px-4 py-2.5">
                  {/* Timeline dot */}
                  <div className="pt-1.5">
                    <div className="skeleton h-2 w-2 rounded-full" />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="skeleton h-4 w-20" />
                      {session === 1 && day === 1 && (
                        <div className="skeleton h-4 w-12 rounded" />
                      )}
                    </div>
                    <div className="skeleton mt-1.5 h-3 w-16" />
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
