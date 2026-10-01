import { type ReactNode, useId } from 'react'

const WIDTH = { md: 'max-w-md', lg: 'max-w-lg' } as const

const CANCEL_CLASS =
  'btn [--btn-bg:var(--color-base-100)] [--btn-border:var(--color-base-300)] hover:[--btn-bg:var(--color-base-200)] disabled:[--btn-border:#0000]'

interface DeleteDocumentDialogProps {
  title: string
  subtitle: ReactNode
  width: keyof typeof WIDTH
  isDeleting: boolean
  canDelete: boolean
  onConfirm: () => void
  onCancel: () => void
  children: ReactNode
}

/** The frame of the admin delete dialogs; each caller keeps its own fetch and body. */
export function DeleteDocumentDialog({
  title,
  subtitle,
  width,
  isDeleting,
  canDelete,
  onConfirm,
  onCancel,
  children
}: DeleteDocumentDialogProps) {
  const titleId = useId()

  return (
    <dialog
      className="modal modal-open bg-[var(--modal-scrim)] motion-safe:backdrop-blur-sm"
      aria-labelledby={titleId}>
      <div
        className={`modal-box border-base-300 flex ${WIDTH[width]} flex-col gap-4 border shadow-xl`}>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={titleId} className="text-xl font-semibold">
            {title}
          </h3>
          {subtitle}
        </div>

        {children}

        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={CANCEL_CLASS}
            onClick={onCancel}
            disabled={isDeleting}
            autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-error"
            onClick={onConfirm}
            disabled={!canDelete || isDeleting}>
            {isDeleting && <span className="loading loading-spinner loading-sm" />}
            Delete document
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={isDeleting ? undefined : onCancel} />
    </dialog>
  )
}
