import { twMerge } from '@utils/twMerge'
import toast, { ToastOptions } from 'react-hot-toast'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning' | 'neutral'

export interface ToastNotificationOptions extends ToastOptions {
  variant?: ToastVariant
  className?: string
  actionLabel?: string
  onAction?: () => void
}

// Neutral renders no status bar.
const variantIndicatorColors: Record<Exclude<ToastVariant, 'neutral'>, string> = {
  success: 'bg-success',
  error: 'bg-error',
  info: 'bg-info',
  warning: 'bg-warning'
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
  // Only an error interrupts: `alert` is assertive, so it takes no polite override.
  const liveRegion =
    variant === 'error'
      ? ({ role: 'alert' } as const)
      : ({ role: 'status', 'aria-live': 'polite' } as const)

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
        {...liveRegion}>
        {variant !== 'neutral' && (
          <span
            className={twMerge('h-6 w-1 shrink-0 rounded-full', variantIndicatorColors[variant])}
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
            className="shrink-0 text-sm font-semibold text-[var(--inverse-action-ink)] hover:underline">
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
