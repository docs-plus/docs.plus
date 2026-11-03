import { openConfirmDialog } from '@components/ui/dialogs/ConfirmDialog'

/** Opens the shared sign-out confirm; sign-out only proceeds through `onConfirm`. */
export function openSignOutConfirm(args: { onConfirm: () => void }): void {
  openConfirmDialog({
    title: 'Sign out?',
    body: 'You’ll need to sign in again to join the conversation and manage your documents.',
    confirmLabel: 'Sign out',
    onConfirm: args.onConfirm
  })
}
