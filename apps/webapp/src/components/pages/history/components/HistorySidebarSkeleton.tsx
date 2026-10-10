import { PanelTabBarSkeleton } from '@components/ui/PanelTabBarSkeleton'
import { Icons } from '@icons'
import { twMerge } from '@utils/twMerge'

import { HistoryLatestBadge, HistoryTimelineDot } from './HistorySidebarRowParts'

const SESSIONS = ['active', 'closed'] as const

/** Body bones for HistorySidebar. The sidebar renders them inside its real frame and header. */
export const HistorySidebarSkeleton = ({ tabs = false }: { tabs?: boolean }) => {
  return (
    <div aria-hidden className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {tabs && <PanelTabBarSkeleton tabCount={2} />}

      {/* Only the day that holds the active version opens; on first load that is the newest day. */}
      {[0, 1, 2].map((day) => {
        const DayChevron = day === 0 ? Icons.chevronUp : Icons.chevronDown
        return (
          <div key={day}>
            <div className="border-base-300 border-b">
              <div className="bg-base-200 flex min-h-10 items-center justify-between gap-2 px-3 py-2">
                <div className="skeleton h-3 w-24" />
                <DayChevron className="text-base-content/50 shrink-0" size={16} />
              </div>
            </div>

            {/* The newest session holds the active version, so it opens with the active frame. */}
            {day === 0 &&
              SESSIONS.map((session) => {
                const active = session === 'active'
                const SessionChevron = active ? Icons.chevronUp : Icons.chevronDown
                return (
                  <div key={session} className="px-3 py-1">
                    <div
                      className={twMerge(
                        'rounded-box bg-base-100 overflow-hidden border',
                        active ? 'border-primary/50' : 'border-base-300'
                      )}>
                      <div className="flex min-h-11 items-center gap-2.5 px-3 py-2.5">
                        <div className="skeleton rounded-field size-5 shrink-0" />
                        {/* Line boxes match the real 20px time and 16px meta lines. */}
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          {/* The newest session is the latest on a first load, so its badge is frame. */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <div className="flex h-5 items-center">
                              <div className="skeleton h-3.5 w-24" />
                            </div>
                            {active && <HistoryLatestBadge />}
                          </div>
                          <div className="flex h-4 items-center">
                            <div className="skeleton h-3 w-16" />
                          </div>
                        </div>
                        <div className="skeleton size-6 shrink-0 rounded-full" />
                        <SessionChevron className="text-base-content/50 shrink-0" size={16} />
                      </div>
                      {active && <ActiveSessionVersions />}
                    </div>
                  </div>
                )
              })}
          </div>
        )
      })}
    </div>
  )
}

/** The first row is the active version, with its fill, dot and copy-link icon. */
function ActiveSessionVersions() {
  return (
    <div className="px-2 pb-2">
      <div className="border-base-300 mx-1 border-t" />
      <div className="mt-1 space-y-0.5">
        {['w-12', 'w-14'].map((width, index) => (
          <div
            key={width}
            className={twMerge('rounded-field flex min-h-10', index === 0 && 'bg-primary/10')}>
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2">
              <HistoryTimelineDot active={index === 0} className="size-1.5 shrink-0" />
              <div className="flex h-5 items-center">
                <div className={`skeleton h-3.5 ${width}`} />
              </div>
            </div>
            <span
              className={twMerge(
                'flex min-w-10 shrink-0 items-center justify-center md:min-w-9',
                index === 0 ? 'text-primary' : 'text-base-content/70 opacity-0 max-md:opacity-100'
              )}>
              <Icons.link size={16} className="stroke-[1.75]" />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
