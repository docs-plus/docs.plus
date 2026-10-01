import { twMerge } from '@utils/twMerge'
import { forwardRef } from 'react'

export type ResizeHandleOrientation = 'horizontal' | 'vertical'

export interface ResizeHandleProps {
  orientation: ResizeHandleOrientation
  onMouseDown: (e: React.MouseEvent) => void
  isResizing?: boolean
  className?: string
}

/** VS Code-style sash: straddles the split; one divider (idle hairline → primary on hover/drag).
 * Mouse only, so no `tabIndex`: a focusable separator must carry `aria-valuenow`, and this has no value. */
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
          isVertical && [
            'top-0 h-full w-[var(--resize-sash-hit)] cursor-col-resize',
            'right-[calc(var(--resize-sash-hit)/-2)]',
            // Anchor at the split and grow into the editor column. A centered hairline loses
            // half its width under the TOC rail (z-42 over z-41), and reads thinner than the chat sash.
            'after:top-0 after:left-1/2 after:h-full after:w-px after:translate-x-0',
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
      />
    )
  }
)

ResizeHandle.displayName = 'ResizeHandle'

export default ResizeHandle
