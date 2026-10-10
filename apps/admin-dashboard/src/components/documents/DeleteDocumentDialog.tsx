import { clsx } from 'clsx'
import { type ReactNode, useId, useState } from 'react'

const WIDTH = { md: 'max-w-md', lg: 'max-w-lg' } as const

const CANCEL_CLASS =
  'btn [--btn-bg:var(--color-base-100)] [--btn-border:var(--color-base-300)] hover:[--btn-bg:var(--color-base-200)] disabled:[--btn-border:#0000]'

interface DeleteDocumentDialogProps {
  title: string
  subtitle: ReactNode
  width: keyof typeof WIDTH
  slug: string
  loading: boolean
  loadingLabel: string
  /** False hides the typed-slug gate, so delete stays off. */
  ready?: boolean
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
  children: ReactNode
}

/** Admin delete dialog: frame, loading state and typed-slug gate. Callers own fetch and body. */
export function DeleteDocumentDialog({
  title,
  subtitle,
  width,
  slug,
  loading,
  loadingLabel,
  ready = true,
  isDeleting,
  onConfirm,
  onCancel,
  children
}: DeleteDocumentDialogProps) {
  const titleId = useId()
  const inputId = useId()
  const [confirmInput, setConfirmInput] = useState('')
  const matches = confirmInput === slug
  const canDelete = ready && !loading && matches

  const handleConfirm = () => {
    if (canDelete) onConfirm()
  }

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

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <span className="loading loading-spinner loading-md" />
            <p className="text-base-content/60 text-sm">{loadingLabel}</p>
          </div>
        ) : (
          <>
            {children}
            {/* A plain label: the daisyUI 5 `.label` is `nowrap`, so a long slug overflows. */}
            {ready && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={inputId} className="text-meta font-semibold">
                  Type <kbd className="kbd kbd-sm h-auto max-w-full break-all">{slug}</kbd> to
                  confirm deletion
                </label>
                <input
                  id={inputId}
                  type="text"
                  className={clsx(
                    'input w-full font-mono',
                    confirmInput && !matches && 'input-error',
                    matches && 'input-success'
                  )}
                  placeholder={slug}
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                  disabled={isDeleting}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}
          </>
        )}

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
            onClick={handleConfirm}
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
