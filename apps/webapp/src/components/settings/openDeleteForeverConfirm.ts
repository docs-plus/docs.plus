import { openConfirmDialog } from '@components/ui/dialogs/ConfirmDialog'
import type { ReactNode } from 'react'

/**
 * Irreversible Trash purge confirm: single "Delete forever", "Empty trash" and bulk delete.
 * A GlobalDialog, not a toast, so it is not an outside press to the Settings modal.
 */
export function openDeleteForeverConfirm(args: {
  /** Consequence copy; the caller phrases single vs. bulk. */
  body: ReactNode
  title?: string
  confirmLabel?: string
  onConfirm: () => void
}): void {
  openConfirmDialog({
    title: args.title ?? 'Delete forever?',
    body: args.body,
    confirmLabel: args.confirmLabel ?? 'Delete forever',
    onConfirm: args.onConfirm
  })
}
