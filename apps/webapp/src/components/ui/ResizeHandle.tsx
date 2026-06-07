import { forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'

export type ResizeHandleOrientation = 'horizontal' | 'vertical'

export interface ResizeHandleProps {
  /** Orientation of the resize handle */
  orientation: ResizeHandleOrientation
  /** Mouse down handler for initiating resize */
  onMouseDown: (e: React.MouseEvent) => void
  /** Whether the handle is currently being dragged */
  isResizing?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * ResizeHandle component following the design system guidelines.
 *
 * Design System Rules:
 * - Handle size: 6-8px hit-area (invisible by default)
 * - Cursor: col-resize (vertical) or row-resize (horizontal)
 * - Visual: thin divider on hover/drag
 * - During drag, parent should disable text selection
 *
 * @example
 * // Vertical resize (between TOC and Editor)
 * <ResizeHandle orientation="vertical" onMouseDown={handleMouseDown} />
 *
 * // Horizontal resize (between Editor and Chat)
 * <ResizeHandle orientation="horizontal" onMouseDown={handleMouseDown} />
 */
const ResizeHandle = forwardRef<HTMLDivElement, ResizeHandleProps>(
  ({ orientation, onMouseDown, isResizing = false, className }, ref) => {
    const isVertical = orientation === 'vertical'

    return (
      <div
        ref={ref}
        onMouseDown={onMouseDown}
        className={twMerge(
          // Base styles - invisible by default, 6px hit area
          'group/resize absolute z-20 transition-colors duration-150 select-none',
          // Vertical (column resize - between left/right panels)
          isVertical && [
            'top-0 right-0 h-full w-1.5',
            'cursor-col-resize',
            // The visible line
            'after:absolute after:top-0 after:right-0 after:h-full after:w-px',
            'after:bg-base-300 after:transition-all after:duration-150',
            // Hover/active state - show thicker line
            'hover:after:bg-primary/50 hover:after:w-0.5',
            isResizing && 'after:bg-primary after:w-0.5'
          ],
          // Horizontal (row resize - between top/bottom panels)
          !isVertical && [
            'bottom-full left-0 h-1.5 w-full',
            'cursor-row-resize',
            // The visible line
            'after:absolute after:bottom-0 after:left-0 after:h-px after:w-full',
            'after:bg-base-300 after:transition-all after:duration-150',
            // Hover/active state
            'hover:after:bg-primary/50 hover:after:h-0.5',
            isResizing && 'after:bg-primary after:h-0.5'
          ],
          className
        )}
        role="separator"
        aria-orientation={isVertical ? 'vertical' : 'horizontal'}
        aria-valuenow={undefined}
        tabIndex={0}
      />
    )
  }
)

ResizeHandle.displayName = 'ResizeHandle'

export default ResizeHandle
