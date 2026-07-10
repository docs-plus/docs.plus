import Button from '@components/ui/Button'
import { useStore } from '@stores'

interface DeleteForeverDialogProps {
  /** Consequence copy — required; the caller phrases single vs. bulk. */
  body: string
  heading?: string
  confirmLabel?: string
  onConfirm: () => void
}

/**
 * Irreversible Trash purge confirm (openDialog) — backs single "Delete forever",
 * "Empty trash", and bulk delete. A GlobalDialog, not a toast, so it isn't an
 * outside-press to the Settings modal's useDismiss.
 */
function DeleteForeverDialog({
  body,
  heading = 'Delete forever?',
  confirmLabel = 'Delete forever',
  onConfirm
}: DeleteForeverDialogProps) {
  const closeDialog = useStore((state) => state.closeDialog)

  const confirm = () => {
    onConfirm()
    closeDialog()
  }

  return (
    <div className="p-5">
      <h2 className="text-base-content text-base font-semibold">{heading}</h2>
      <p className="text-base-content/70 mt-2 text-sm">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={closeDialog}>
          Cancel
        </Button>
        <Button variant="error" size="sm" onClick={confirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

export default DeleteForeverDialog
