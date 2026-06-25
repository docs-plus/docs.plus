import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

import { HOME_REGION_MOTION_EASE } from './homeMobileLayout'

interface HomeCollapseRegionProps {
  collapsed: boolean
  children: ReactNode
  className?: string
  /** Tailwind max-height when expanded on mobile — must exceed content height for transition. */
  expandedMaxClass?: string
}

/** Mobile-only height/opacity collapse with motion tokens; desktop stays visible. */
export function HomeCollapseRegion({
  collapsed,
  children,
  className,
  expandedMaxClass = 'max-sm:max-h-40'
}: HomeCollapseRegionProps) {
  return (
    <div
      className={twMerge(
        'overflow-hidden motion-safe:transition-[opacity,max-height,margin]',
        HOME_REGION_MOTION_EASE,
        collapsed
          ? 'max-sm:pointer-events-none max-sm:max-h-0 max-sm:opacity-0'
          : ['max-sm:opacity-100', expandedMaxClass],
        className
      )}>
      {children}
    </div>
  )
}
