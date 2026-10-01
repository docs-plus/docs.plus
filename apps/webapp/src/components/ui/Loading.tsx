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
 * The one block spinner. It waits 300ms before it shows, so fast loads never flash. The delay
 * is CSS and not motion-gated: it is functional, and the fade is opacity only.
 * Ink is inherited `currentColor`, because a spinner is status, not interaction.
 */
export function Loading({ size = 'md', label = 'Loading', className }: LoadingProps) {
  return (
    <div
      role="status"
      className={twMerge(
        'flex size-full animate-[doc-content-in_120ms_ease-out_300ms_both] items-center justify-center',
        className
      )}>
      <span className={twMerge('loading loading-spinner', SIZE_CLASS[size])} aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export default Loading
