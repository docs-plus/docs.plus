import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

import { HOME_REGION_DURATION, homeRegionEase } from './homeMobileLayout'

interface HomeCollapseRegionProps {
  collapsed: boolean
  children: ReactNode
  className?: string
}

/** Mobile-only collapse via animated `grid-template-rows` (0fr↔1fr): eases to the content's
 * natural height with no max-height guesswork. `min-h-0` lets the region shrink fully when it is
 * itself a flex child (the footer). Margin rides the transition so callers collapse spacing
 * through `className`. Desktop stays expanded. */
export function HomeCollapseRegion({ collapsed, children, className }: HomeCollapseRegionProps) {
  return (
    <div
      className={twMerge(
        'grid min-h-0 motion-safe:transition-[grid-template-rows,opacity,margin]',
        HOME_REGION_DURATION,
        homeRegionEase(collapsed),
        collapsed
          ? 'max-sm:pointer-events-none max-sm:grid-rows-[0fr] max-sm:opacity-0'
          : 'max-sm:grid-rows-[1fr] max-sm:opacity-100',
        className
      )}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
