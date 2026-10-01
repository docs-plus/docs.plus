import { openConfirmDialog } from '@components/ui/dialogs/ConfirmDialog'

/** Opens the shared sign-out confirm; sign-out only proceeds through `onConfirm`. */
export function openSignOutConfirm(args: { onConfirm: () => void }): void {
  openConfirmDialog({
    title: 'Sign out?',
    body: 'You’ll need to sign in again to edit documents or join the conversation.',
    confirmLabel: 'Sign out',
    onConfirm: args.onConfirm
  })
}
