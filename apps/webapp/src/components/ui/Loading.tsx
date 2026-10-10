import { twMerge } from '@utils/twMerge'

export type LoadingSize = 'sm' | 'md' | 'lg'

// Literal classes: Tailwind cannot see an interpolated `loading-${size}`.
const SIZE_CLASS: Record<LoadingSize, string> = {
  sm: 'loading-sm',
  md: 'loading-md',
  lg: 'loading-lg'
}

export interface LoadingProps {
  /** By scope: `lg` a page or full pane, `md` a panel or section, `sm` a row or inline slot. */
  size?: LoadingSize
  /** Screen-reader text for the status region. */
  label?: string
  className?: string
}

/**
 * The one block spinner. It stays hidden for 300ms, then shows at once, so fast loads never
 * flash and a loader never fades in. `step-end` turns the `doc-content-in` fade into that gate.
 * The delay is CSS and not motion-gated, because it is functional. Ink is `currentColor`.
 */
export function Loading({ size = 'md', label = 'Loading', className }: LoadingProps) {
  return (
    <div
      role="status"
      className={twMerge(
        'flex size-full animate-[doc-content-in_300ms_step-end_both] items-center justify-center',
        className
      )}>
      <span className={twMerge('loading loading-spinner', SIZE_CLASS[size])} aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default Loading
