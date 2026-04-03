import { type CSSProperties, forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

type ScrollOrientation = 'vertical' | 'horizontal' | 'both'
type ScrollbarSize = 'thin' | 'default'

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  orientation?: ScrollOrientation
  scrollbarSize?: ScrollbarSize
  hideScrollbar?: boolean
  /**
   * Reserve space for the scrollbar (`scrollbar-gutter: stable`) to avoid layout shift.
   * @default true
   */
  preserveWidth?: boolean
}

/** Single scrollable root + theme scrollbar classes — no inner wrapper. */
const SCROLL_ROOT = 'relative min-h-0 min-w-0 scroll-smooth scrollbar-custom' as const

const ORIENTATION_CLASS: Record<ScrollOrientation, string> = {
  vertical: 'overflow-y-auto overflow-x-hidden',
  horizontal: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto'
}

const SCROLLBAR_SIZE_CLASS: Record<ScrollbarSize, string> = {
  thin: 'scrollbar-thin',
  default: 'scrollbar-default'
}

function mergeScrollStyle(
  preserveWidth: boolean,
  style: CSSProperties | undefined
): CSSProperties | undefined {
  if (!preserveWidth) return style
  return style ? { scrollbarGutter: 'stable', ...style } : { scrollbarGutter: 'stable' }
}

function scrollAreaClassName(
  orientation: ScrollOrientation,
  scrollbarSize: ScrollbarSize,
  hideScrollbar: boolean,
  className: string | undefined
): string {
  return twMerge(
    SCROLL_ROOT,
    ORIENTATION_CLASS[orientation],
    hideScrollbar ? 'scrollbar-hide' : SCROLLBAR_SIZE_CLASS[scrollbarSize],
    className
  )
}

const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  {
    children,
    className,
    orientation = 'vertical',
    scrollbarSize = 'default',
    hideScrollbar = false,
    preserveWidth = true,
    style,
    ...props
  },
  ref
) {
  return (
    <div
      ref={ref}
      className={scrollAreaClassName(orientation, scrollbarSize, hideScrollbar, className)}
      style={mergeScrollStyle(preserveWidth, style)}
      {...props}>
      {children}
    </div>
  )
})

ScrollArea.displayName = 'ScrollArea'

export { ScrollArea }
