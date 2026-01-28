import { ScrollArea } from '@components/ui/ScrollArea'

const SidebarLoader = () => {
  return (
    <div className="bg-base-100 border-base-300 flex h-full w-64 flex-col border-l">
      {/* Header */}
      <div className="border-base-300 border-b p-4">
        <div className="skeleton h-5 w-36 rounded" />
        <div className="skeleton mt-2 h-3 w-24 rounded" />
      </div>

      {/* Version list */}
      <ScrollArea className="flex-1" orientation="vertical" scrollbarSize="thin" hideScrollbar>
        {[1, 2, 3].map((day) => (
          <div key={day} className="border-base-200 border-b">
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
      </ScrollArea>
    </div>
  )
}

export default SidebarLoader
