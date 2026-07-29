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
          'pointer-events-auto flex max-w-md items-center gap-3',
          'rounded-box px-4 py-3',
          // Theme-aware inverse surface (light-dark via color-scheme, no dark: variant)
          'surface-inverse-raised',
          'shadow-xl',
          'transition-[opacity,transform] duration-200 ease-out',
          t.visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          opts.className
        )}
        role="alert"
        aria-live="polite">
        {variant !== 'neutral' && (
          <span
            className={twMerge('h-6 w-1 shrink-0 rounded-full', indicatorColor)}
            aria-hidden="true"
          />
        )}

        <div className="flex-1 text-sm font-medium">{content}</div>

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
