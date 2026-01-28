import toast, { ToastOptions } from 'react-hot-toast'
import { twMerge } from 'tailwind-merge'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning' | 'neutral'

export interface ToastNotificationOptions extends ToastOptions {
  /** Toast variant for indicator color */
  variant?: ToastVariant
  /** Additional CSS classes */
  className?: string
  /** Action button label */
  actionLabel?: string
  /** Action button callback */
  onAction?: () => void
}

// Indicator colors for each variant
const variantIndicatorColors: Record<ToastVariant, string> = {
  success: 'bg-success',
  error: 'bg-error',
  info: 'bg-info',
  warning: 'bg-warning',
  neutral: 'bg-neutral-content/30'
}

const defaultOptions: ToastNotificationOptions = {
  position: 'bottom-center',
  duration: 4000,
  variant: 'neutral'
}

/**
 * ToastNotification - Theme-aware toast with colored left indicator.
 *
 * Design:
 * - Light theme: Dark background (`bg-neutral`) with white text
 * - Dark theme: Light background (`bg-base-100`) with dark text
 * - Colored vertical indicator bar on left
 * - Fully dynamic content (text, icons, or any React node)
 * - Optional action button
 *
 * @example
 * // Simple text
 * ToastNotification('Document saved', { variant: 'success' })
 *
 * // With action
 * ToastNotification('Item deleted', { variant: 'error', actionLabel: 'Undo', onAction: restore })
 *
 * // With custom content (icons + text)
 * ToastNotification(
 *   <span className="flex items-center gap-2"><MdCheck /> Saved</span>,
 *   { variant: 'success' }
 * )
 */
export const ToastNotification = (
  content: React.ReactNode,
  options?: Partial<ToastNotificationOptions>
) => {
  const opts = { ...defaultOptions, ...options }
  const variant = opts.variant || 'neutral'
  const indicatorColor = variantIndicatorColors[variant]

  return toast.custom(
    (t) => (
      <div
        className={twMerge(
          // Base styles
          'pointer-events-auto flex max-w-md items-center gap-3',
          'rounded-2xl px-4 py-3',
          // Theme-aware background: dark on light, light on dark
          'bg-neutral text-neutral-content',
          'dark:bg-base-100 dark:text-base-content',
          // Shadow for depth
          'shadow-xl',
          // Animation
          'transition-all duration-300 ease-out',
          t.visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
          // Custom classes
          opts.className
        )}
        role="alert"
        aria-live="polite">
        {/* Colored indicator bar */}
        {variant !== 'neutral' && (
          <span
            className={twMerge('h-6 w-1 shrink-0 rounded-full', indicatorColor)}
            aria-hidden="true"
          />
        )}

        {/* Content - fully dynamic */}
        <div className="flex-1 text-sm font-medium">{content}</div>

        {/* Action button (optional) */}
        {opts.actionLabel && opts.onAction && (
          <button
            type="button"
            onClick={() => {
              opts.onAction?.()
              toast.dismiss(t.id)
            }}
            className="text-info shrink-0 text-sm font-semibold transition-colors hover:opacity-80">
            {opts.actionLabel}
          </button>
        )}
      </div>
    ),
    {
      id: opts.id,
      duration: opts.duration,
      position: opts.position
    }
  )
}

export default ToastNotification
