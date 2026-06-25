import Button from '@components/ui/Button'
import { Modal, ModalContent, ModalDescription, ModalHeading } from '@components/ui/Dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: number | undefined
  onConfirm: () => void
}

export function HistoryRestoreModal({ open, onOpenChange, version, onConfirm }: Props) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="sm" className="p-6">
        <ModalHeading className="text-base-content text-lg font-semibold">
          Revert to version {version}?
        </ModalHeading>
        <ModalDescription className="text-base-content/70 mt-2 text-sm">
          The editor will show this snapshot. Save or sync applies it like any other edit.
        </ModalDescription>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}>
            Revert
          </Button>
        </div>
      </ModalContent>
    </Modal>
  )
}
