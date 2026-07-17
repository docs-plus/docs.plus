import Button from '@components/ui/Button'
import { useStore } from '@stores'

type SignOutConfirmDialogProps = {
  onConfirm: () => void
}

/** Confirm sign-out — GlobalDialog so it isn't light-dismissed with Settings. */
function SignOutConfirmDialog({ onConfirm }: SignOutConfirmDialogProps) {
  const closeDialog = useStore((state) => state.closeDialog)

  const confirm = () => {
    closeDialog()
    onConfirm()
  }

  return (
    <div className="p-5">
      <h2 className="text-base-content text-base font-semibold">Sign out?</h2>
      <p className="text-base-content/70 mt-2 text-sm">
        You&apos;ll need to sign in again to edit documents or join the conversation.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => closeDialog()}>
          Cancel
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={confirm}
          className="text-error hover:bg-error/10">
          Sign out
        </Button>
      </div>
    </div>
  )
}

export default SignOutConfirmDialog
