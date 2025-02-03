const SidebarLoader = () => {
  return (
    <div className="sidebar flex h-full w-[25%] flex-col border-l border-gray-200 bg-base-100">
      <div className="h-[94px] border-gray-200 p-4">
        <h2 className="mb-2 text-2xl font-bold text-base-content">Version History</h2>
        <p className="text-sm font-medium text-base-content/60">Auto versioning enabled</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="flex w-[22%] flex-col space-y-6 px-4">
          {/* Day groups - create 3 day sections */}
          {[1, 2, 3].map((day) => (
            <div key={day} className="space-y-3">
              {/* Date header */}
              <div className="skeleton h-5 w-48"></div>

              {/* Hour groups - 2-3 time blocks per day */}
              {[...Array(Math.floor(Math.random() * 2) + 2)].map((_, hourIndex) => (
                <div key={hourIndex} className="ml-2 space-y-2">
                  {/* Hour header */}
                  <div className="skeleton h-4 w-20"></div>

                  {/* Version entries - 2-4 entries per hour */}
                  {[...Array(Math.floor(Math.random() * 3) + 2)].map((_, versionIndex) => (
                    <div key={versionIndex} className="ml-4 space-y-1">
                      <div className="skeleton h-4 w-32"></div>
                      <div className="skeleton h-3 w-24 opacity-60"></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SidebarLoader
