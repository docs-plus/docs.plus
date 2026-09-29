import Button from '@components/ui/Button'
import { ModalHeading } from '@components/ui/Dialog'
import { useStore } from '@stores'

type DisconnectAppDialogProps = {
  name: string
  onConfirm: () => void
}

/** GlobalDialog, so it is not light-dismissed with Settings. */
function DisconnectAppDialog({ name, onConfirm }: DisconnectAppDialogProps) {
  const closeDialog = useStore((state) => state.closeDialog)

  const confirm = () => {
    closeDialog()
    onConfirm()
  }

  return (
    <div className="p-5">
      <ModalHeading className="text-base-content text-base font-semibold [overflow-wrap:anywhere]">
        Disconnect <bdi>{name}</bdi>?
      </ModalHeading>
      <p className="text-base-content/70 mt-2 text-sm">
        This ends its access to your account. The app may keep what it already read. Remove the
        connector in the app too.
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
          Disconnect
        </Button>
      </div>
    </div>
  )
}

export default DisconnectAppDialog
