import { openConfirmDialog } from '@components/ui/dialogs/ConfirmDialog'

/** Opens the shared Private ON confirm; `onDismiss` runs on Cancel/Esc/scrim/unmount. */
export function openMakePrivateConfirm(args: {
  onConfirm: () => void
  onDismiss?: () => void
}): void {
  // Not destructive: the owner can switch it back, so the primary tone.
  openConfirmDialog({
    title: 'Make this document private?',
    body: 'Only you will be able to open it. Anyone currently viewing will lose access.',
    confirmLabel: 'Make private',
    tone: 'default',
    onConfirm: args.onConfirm,
    onDismiss: args.onDismiss
  })
}
