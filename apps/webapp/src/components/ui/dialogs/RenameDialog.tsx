import Button from '@components/ui/Button'
import { DialogActions, ModalBody, ModalClose, ModalHeading } from '@components/ui/Dialog'
import TextInput from '@components/ui/TextInput'
import { useStore } from '@stores'
import { useEffect, useRef, useState } from 'react'

export interface RenameDialogProps {
  initialValue: string
  /** Gets the raw draft. The caller trims, skips an empty or unchanged value, and closes. */
  onSave: (draft: string) => void
  /** Shows the spinner on the save button and keeps its label. */
  busy?: boolean
  maxLength?: number
}

/**
 * The one rename body: title, a labelled field, then Cancel and the save button.
 * Save is never disabled; an empty draft reverts in the caller with no write.
 */
export function RenameDialog({ initialValue, onSave, busy = false, maxLength }: RenameDialogProps) {
  const closeDialog = useStore((state) => state.closeDialog)
  const [draft, setDraft] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.select(), 120)
    return () => clearTimeout(timer)
  }, [])

  return (
    <ModalBody>
      <ModalHeading className="pr-10">Rename document</ModalHeading>
      <ModalClose />
      <TextInput
        ref={inputRef}
        labelPosition="above"
        label="Title"
        value={draft}
        maxLength={maxLength}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSave(draft)
        }}
        autoComplete="off"
      />
      <DialogActions>
        <Button variant="cancel" onClick={closeDialog}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => onSave(draft)} loading={busy}>
          Rename
        </Button>
      </DialogActions>
    </ModalBody>
  )
}
