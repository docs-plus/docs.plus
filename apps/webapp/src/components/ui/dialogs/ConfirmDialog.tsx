import Button from '@components/ui/Button'
import {
  DialogActions,
  ModalBody,
  ModalDescription,
  ModalHeading,
  useModalRole
} from '@components/ui/Dialog'
import { useStore } from '@stores'
import { createElement, ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'

export type ConfirmTone = 'danger' | 'default'

export interface ConfirmDialogProps {
  /** A statement or a question, with no icon. Wrap a user-given name in `<bdi>`. */
  title: ReactNode
  /** The consequence in one or two sentences. Inline content only; it renders in a `p`. */
  body: ReactNode
  /** Extra lines under the body, such as a count. */
  children?: ReactNode
  /** Verb, or verb + noun, from the title: "Sign out", "Delete forever". */
  confirmLabel: string
  /** `danger` removes access, data or a session (`btn-error`). `default` is `btn-primary`. */
  tone?: ConfirmTone
  onConfirm: () => void | Promise<unknown>
  /** Keep the dialog open with a busy confirm until `onConfirm` settles. A rejection re-enables it. */
  waitForConfirm?: boolean
  /** Runs on unmount, however the dialog closed. */
  onDismiss?: () => void
}

/**
 * The one confirm body. Cancel renders first, so the focus manager focuses it on open.
 * By default it closes before `onConfirm` runs: Sign out pops history, and an open
 * dialog would still hold its own history entry.
 */
export function ConfirmDialog({
  title,
  body,
  children,
  confirmLabel,
  tone = 'danger',
  onConfirm,
  waitForConfirm = false,
  onDismiss
}: ConfirmDialogProps) {
  useModalRole('alertdialog')
  const closeDialog = useStore((state) => state.closeDialog)
  const [busy, setBusy] = useState(false)

  const onDismissRef = useRef(onDismiss)
  useLayoutEffect(() => {
    onDismissRef.current = onDismiss
  })
  useEffect(() => () => onDismissRef.current?.(), [])

  const confirm = async () => {
    if (!waitForConfirm) {
      closeDialog()
      void onConfirm()
      return
    }
    setBusy(true)
    try {
      await onConfirm()
      closeDialog()
    } catch {
      setBusy(false)
    }
  }

  return (
    <ModalBody>
      <div className="flex flex-col gap-1">
        <ModalHeading className="[overflow-wrap:anywhere]">{title}</ModalHeading>
        <ModalDescription>{body}</ModalDescription>
      </div>
      {children}
      <DialogActions>
        <Button variant="cancel" disabled={busy} onClick={closeDialog}>
          Cancel
        </Button>
        <Button variant={tone === 'danger' ? 'error' : 'primary'} loading={busy} onClick={confirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </ModalBody>
  )
}

/** Opens a confirm in GlobalDialog at the `sm` width. Feature `open*Confirm` helpers call this. */
export function openConfirmDialog(props: ConfirmDialogProps): void {
  useStore.getState().openDialog(createElement(ConfirmDialog, props), { size: 'sm' })
}
