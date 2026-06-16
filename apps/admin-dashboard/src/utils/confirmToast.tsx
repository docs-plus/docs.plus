import type { ReactNode } from 'react'
import toast from 'react-hot-toast'

interface ConfirmToastOptions {
  title: ReactNode
  body: ReactNode
  /** daisyUI button modifier for the confirm action (defaults to destructive). */
  confirmClass?: string
  onConfirm: () => void
}

/** Inline confirm-then-act toast (10s). Confirm runs onConfirm then dismisses. */
export function confirmToast({
  title,
  body,
  confirmClass = 'btn-error',
  onConfirm
}: ConfirmToastOptions) {
  toast(
    (t) => (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs opacity-70">{body}</p>
        <div className="flex gap-2">
          <button
            className={`btn btn-xs ${confirmClass}`}
            onClick={() => {
              onConfirm()
              toast.dismiss(t.id)
            }}>
            Confirm
          </button>
          <button className="btn btn-ghost btn-xs" onClick={() => toast.dismiss(t.id)}>
            Cancel
          </button>
        </div>
      </div>
    ),
    { duration: 10000 }
  )
}
