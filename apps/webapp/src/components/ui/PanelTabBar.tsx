import { formatCappedCount } from '@utils/formatCappedCount'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

export type PanelTabOption<T extends string = string> = {
  label: T
  count?: number
}

type PanelTabBarProps<T extends string> = {
  tabs: readonly PanelTabOption<T>[]
  activeTab: T
  onSelect: (tab: T) => void
  capitalize?: boolean
}

type IndicatorRect = { left: number; width: number }

function tabAriaLabel(label: string, count?: number): string {
  if (!count || count <= 0) return label
  return `${label}, ${formatCappedCount(count)}`
}

function TabCountBadge({ count, isActive }: { count: number; isActive: boolean }) {
  return (
    <span
      aria-hidden
      className={twMerge(
        'badge badge-xs badge-error text-error-content animate-badge-entry absolute -top-2.5 left-full ml-0.5 min-h-4 min-w-4 -translate-y-px rounded-full border-0 px-1 text-[10px] leading-none font-semibold tabular-nums shadow-sm ring-2',
        isActive ? 'ring-base-100' : 'ring-base-300'
      )}>
      {formatCappedCount(count)}
    </span>
  )
}

export function PanelTabBar<T extends string>({
  tabs,
  activeTab,
  onSelect,
  capitalize = false
}: PanelTabBarProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef(new Map<T, HTMLButtonElement>())
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null)

  const measureIndicator = useCallback(() => {
    const track = trackRef.current
    const activeEl = tabRefs.current.get(activeTab)
    if (!track || !activeEl) return

    const trackRect = track.getBoundingClientRect()
    const tabRect = activeEl.getBoundingClientRect()
    setIndicator({
      left: tabRect.left - trackRect.left,
      width: tabRect.width
    })
  }, [activeTab])

  useLayoutEffect(() => {
    measureIndicator()
    const track = trackRef.current
    if (!track) return

    const observer = new ResizeObserver(measureIndicator)
    observer.observe(track)
    for (const el of tabRefs.current.values()) observer.observe(el)

    return () => observer.disconnect()
  }, [measureIndicator, tabs])

  const setTabRef = (label: T) => (el: HTMLButtonElement | null) => {
    if (el) tabRefs.current.set(label, el)
    else tabRefs.current.delete(label)
  }

  const labelClass = capitalize ? 'capitalize' : undefined

  return (
    <div className="shrink-0 overflow-visible px-4 py-2.5">
      <div
        ref={trackRef}
        role="tablist"
        className="bg-base-300 rounded-box relative flex w-full overflow-visible p-1">
        {indicator && (
          <span
            aria-hidden
            className="bg-base-100 rounded-field pointer-events-none absolute top-1 bottom-1 shadow-sm transition-[left,width] duration-200 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
        )}
        {tabs.map((tab) => {
          const isActive = activeTab === tab.label
          const count = tab.count

          return (
            <button
              key={tab.label}
              ref={setTabRef(tab.label)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={tabAriaLabel(tab.label, count)}
              onClick={() => onSelect(tab.label)}
              className={twMerge(
                'rounded-field relative z-10 flex min-h-9 flex-1 items-center justify-center px-2 py-1.5 text-sm font-medium transition-colors duration-200',
                isActive
                  ? 'text-base-content font-semibold'
                  : 'text-base-content/70 hover:text-base-content'
              )}>
              <span className="relative inline-block">
                <span className={labelClass}>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <TabCountBadge count={count} isActive={isActive} />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
