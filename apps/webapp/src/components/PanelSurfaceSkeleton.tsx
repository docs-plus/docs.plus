import { PanelTabBarSkeleton } from '@components/ui/PanelTabBarSkeleton'
import { TextLine } from '@components/ui/TextLine'
import type { ReactNode } from 'react'

type PanelSurfaceSkeletonProps = {
  /** No tab track when absent. */
  tabCount?: number
  /** Width of the title bone, sized to the real title. */
  titleWidthClassName?: string
  /** Drawn before the close bone, like the real `headerActions`. */
  headerActions?: ReactNode
  children: ReactNode
}

/** The popover `PanelSurfaceShell` while its chunk loads: header, tab track, then body bones. */
export function PanelSurfaceSkeleton({
  tabCount,
  titleWidthClassName = 'w-24',
  headerActions,
  children
}: PanelSurfaceSkeletonProps) {
  return (
    <div className="bg-base-100 flex w-full flex-col" aria-hidden>
      <div className="border-base-300 flex items-center justify-between border-b px-4 py-3">
        <TextLine box="h-6" bone={`h-4 ${titleWidthClassName}`} />
        <div className="flex items-center gap-1">
          {headerActions}
          <div className="skeleton rounded-field size-8" />
        </div>
      </div>
      {tabCount != null && <PanelTabBarSkeleton tabCount={tabCount} />}
      {children}
    </div>
  )
}
