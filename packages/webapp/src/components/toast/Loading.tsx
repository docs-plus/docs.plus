import toast from 'react-hot-toast'
import { twMerge } from 'tailwind-merge'

export interface LoadingToastOptions {
  /** Toast ID for programmatic dismissal */
  id?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Loading toast - Neutral style with spinner, persists until dismissed.
 *
 * @example
 * const toastId = toast.Loading('Saving...')
 * // Later:
 * toast.dismiss(toastId)
 *
 * @example
 * // Replace with result
 * const toastId = toast.Loading('Processing...')
 * await doSomething()
 * toast.Success('Done!', { id: toastId })
 */
export const Loading = (content: React.ReactNode, options?: LoadingToastOptions) => {
  return toast.custom(
    (t) => (
      <div
        className={twMerge(
          // Base styles
          'pointer-events-auto flex max-w-md items-center gap-3',
          'rounded-2xl px-4 py-3',
          // Theme-aware background
          'bg-neutral text-neutral-content',
          'dark:bg-base-100 dark:text-base-content',
          // Shadow
          'shadow-xl',
          // Animation
          'transition-all duration-300 ease-out',
          t.visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
          options?.className
        )}
        role="status"
        aria-live="polite">
        {/* Spinner */}
        <span className="loading loading-spinner loading-sm shrink-0" />

        {/* Content */}
        <div className="flex-1 text-sm font-medium">{content}</div>
      </div>
    ),
    {
      id: options?.id,
      duration: Infinity // Loading toasts persist until dismissed
    }
  )
}

/**
 * Dismiss a toast by ID.
 */
export const dismiss = toast.dismiss

/**
 * Dismiss all toasts.
 */
export const dismissAll = () => toast.dismiss()
