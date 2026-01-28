import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** Content to render inside the scroll area */
  children: ReactNode
  /** Orientation of the scroll area */
  orientation?: 'vertical' | 'horizontal' | 'both'
  /** Size of the scrollbar */
  scrollbarSize?: 'thin' | 'default'
  /** Whether to hide scrollbar until hover */
  hideScrollbar?: boolean
  /**
   * Preserve content width by reserving space for scrollbar.
   * Prevents layout shift when scrollbar appears/disappears.
   * Uses CSS `scrollbar-gutter: stable`.
   * @default true
   */
  preserveWidth?: boolean
  /** Additional class name for the viewport */
  viewportClassName?: string
}

/**
 * A custom scroll area component with smooth scrolling and styled scrollbars.
 * Provides a consistent, minimal scrollbar across all browsers.
 *
 * Features:
 * - Prevents layout shift with `preserveWidth` (scrollbar-gutter: stable)
 * - Smooth scrolling
 * - Custom styled scrollbars (thin or default)
 * - Hide scrollbar until hover option
 *
 * @example
 * ```tsx
 * // Basic usage - preserves width by default
 * <ScrollArea className="h-64">
 *   <div>Scrollable content here...</div>
 * </ScrollArea>
 *
 * // With hidden scrollbar that shows on hover
 * <ScrollArea hideScrollbar preserveWidth>
 *   <div>Content...</div>
 * </ScrollArea>
 * ```
 */
const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    {
      children,
      className,
      orientation = 'vertical',
      scrollbarSize = 'default',
      hideScrollbar = false,
      preserveWidth = true,
      viewportClassName,
      style,
      ...props
    },
    ref
  ) => {
    const orientationClasses = {
      vertical: 'overflow-y-auto overflow-x-hidden',
      horizontal: 'overflow-x-auto overflow-y-hidden',
      both: 'overflow-auto'
    }

    const scrollbarSizeClasses = {
      thin: 'scrollbar-thin',
      default: 'scrollbar-default'
    }

    // Scrollbar gutter for stable width - prevents layout shift
    const gutterStyle = preserveWidth ? { scrollbarGutter: 'stable' as const, ...style } : style

    return (
      <div
        ref={ref}
        className={twMerge(
          // Base styles
          'relative scroll-smooth',
          // Orientation
          orientationClasses[orientation],
          // Custom scrollbar styling
          'scrollbar-custom',
          // Scrollbar size (only when not hiding)
          !hideScrollbar && scrollbarSizeClasses[scrollbarSize],
          // Hide scrollbar option - CSS handles hover state via .scrollbar-hide:hover
          hideScrollbar && 'scrollbar-hide',
          // User classes
          className
        )}
        style={gutterStyle}
        {...props}>
        <div className={twMerge('min-h-0 min-w-0', viewportClassName)}>{children}</div>
      </div>
    )
  }
)

ScrollArea.displayName = 'ScrollArea'

export { ScrollArea }
export type { ScrollAreaProps }
