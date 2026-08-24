import toast from 'react-hot-toast'
import { twMerge } from 'tailwind-merge'

export interface LoadingToastOptions {
  id?: string
  className?: string
}

export const Loading = (content: React.ReactNode, options?: LoadingToastOptions) => {
  return toast.custom(
    (t) => (
      <div
        className={twMerge(
          'pointer-events-auto flex max-w-md items-center gap-3',
          'rounded-box px-4 py-3',
          // Theme-aware inverse surface (light-dark via color-scheme, no dark: variant)
          'surface-inverse-raised',
          'shadow-xl',
          'transition-all duration-300 ease-out',
          t.visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
          options?.className
        )}
        role="status"
        aria-live="polite">
        <span className="loading loading-spinner loading-sm shrink-0" />

        <div className="flex-1 text-sm font-medium">{content}</div>
      </div>
    ),
    {
      id: options?.id,
      duration: Infinity
    }
  )
}

export const dismiss = toast.dismiss

export const dismissAll = () => toast.dismiss()
