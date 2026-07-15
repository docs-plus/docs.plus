import Button from '@components/ui/Button'
import { useStore } from '@stores'
import { useEffect } from 'react'

type MakePrivateDialogProps = {
  onConfirm: () => void
  /** Cancel, Esc, scrim, or unmount after confirm — clears parent “confirming” disable. */
  onDismiss?: () => void
}

/** Confirm Private ON — GlobalDialog so it isn't light-dismissed with Settings. */
function MakePrivateDialog({ onConfirm, onDismiss }: MakePrivateDialogProps) {
  const closeDialog = useStore((state) => state.closeDialog)

  useEffect(() => () => onDismiss?.(), [onDismiss])

  const dismiss = () => {
    closeDialog()
  }

  const confirm = () => {
    onConfirm()
    closeDialog()
  }

  return (
    <div className="p-5">
      <h2 className="text-base-content text-base font-semibold">Make this document private?</h2>
      <p className="text-base-content/70 mt-2 text-sm">
        Only you will be able to open it. Anyone currently viewing will lose access.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={confirm}>
          Make private
        </Button>
      </div>
    </div>
  )
}

export default MakePrivateDialog
