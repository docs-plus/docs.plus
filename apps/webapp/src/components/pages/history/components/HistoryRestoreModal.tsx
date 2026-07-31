import Button from '@components/ui/Button'
import { Modal, ModalContent, ModalDescription, ModalHeading } from '@components/ui/Dialog'

import { formatVersionDate } from '../helpers'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  version: number | undefined
  createdAt: string | undefined
  /** Versions saved after this one, or null when the active version is not in the list. */
  newerCount: number | null
  onConfirm: () => void
}

export function HistoryRestoreModal({
  open,
  onOpenChange,
  version,
  createdAt,
  newerCount,
  onConfirm
}: Props) {
  // A date and time is what the sidebar shows; the version number appears nowhere
  // a reader can see, so naming one here would point at nothing.
  const stamp = createdAt ? formatVersionDate(createdAt) : null
  const heading = stamp
    ? `Restore the version from ${stamp.date}, ${stamp.time}?`
    : `Restore version ${version}?`

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="sm" className="p-6">
        <ModalHeading className="text-base-content text-lg font-semibold">{heading}</ModalHeading>
        <ModalDescription className="text-base-content/70 mt-2 text-sm">
          This replaces the document for everyone working in it, right now. The document you have
          now is saved first, so you can go back to it.
        </ModalDescription>
        {newerCount !== null && newerCount > 0 && (
          <p className="text-base-content/70 mt-2 text-sm">
            {newerCount === 1
              ? '1 version was saved after this one.'
              : `${newerCount} versions were saved after this one.`}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="max-md:min-h-11"
            onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="error"
            className="max-md:min-h-11"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}>
            Restore
          </Button>
        </div>
      </ModalContent>
    </Modal>
  )
}
