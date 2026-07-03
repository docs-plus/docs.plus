import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

export type ResizeHandleOrientation = 'horizontal' | 'vertical'

export interface ResizeHandleProps {
  orientation: ResizeHandleOrientation
  onMouseDown: (e: React.MouseEvent) => void
  isResizing?: boolean
  className?: string
}

/** VS Code-style sash: stradds the split; one divider (idle hairline → primary on hover/drag). */
const ResizeHandle = forwardRef<HTMLDivElement, ResizeHandleProps>(
  ({ orientation, onMouseDown, isResizing = false, className }, ref) => {
    const isVertical = orientation === 'vertical'
    const active = isResizing

    const sashLine = [
      "after:pointer-events-none after:absolute after:content-['']",
      'after:transition-[width,height,background-color,opacity] after:duration-150',
      active
        ? 'after:bg-[var(--resize-sash-hover)]'
        : 'after:bg-[var(--resize-sash-idle)] hover:after:bg-[var(--resize-sash-hover)]'
    ]

    return (
      <div
        ref={ref}
        onMouseDown={onMouseDown}
        className={twMerge(
          'absolute touch-none select-none',
          'focus-visible:ring-primary focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
          isVertical && [
            'top-0 h-full w-[var(--resize-sash-hit)] cursor-col-resize',
            'right-[calc(var(--resize-sash-hit)/-2)]',
            'after:top-0 after:left-1/2 after:h-full after:w-px after:-translate-x-1/2',
            active
              ? 'after:w-[var(--resize-sash-size)]'
              : 'hover:after:w-[var(--resize-sash-size)]',
            ...sashLine
          ],
          !isVertical && [
            'bottom-full left-0 h-[var(--resize-sash-hit)] w-full cursor-row-resize',
            'after:bottom-0 after:left-0 after:h-px after:w-full',
            active
              ? 'after:h-[var(--resize-sash-size)]'
              : 'hover:after:h-[var(--resize-sash-size)]',
            ...sashLine
          ],
          className
        )}
        role="separator"
        aria-orientation={isVertical ? 'vertical' : 'horizontal'}
        aria-valuetext={active ? 'Resizing' : undefined}
        tabIndex={-1}
      />
    )
  }
)

ResizeHandle.displayName = 'ResizeHandle'

export default ResizeHandle
