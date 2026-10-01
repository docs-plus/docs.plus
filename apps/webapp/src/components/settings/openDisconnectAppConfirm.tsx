import { openConfirmDialog } from '@components/ui/dialogs/ConfirmDialog'

/** Opens the Disconnect confirm; the revoke only runs through `onConfirm`. */
export function openDisconnectAppConfirm(args: { name: string; onConfirm: () => void }): void {
  openConfirmDialog({
    title: (
      <>
        Disconnect <bdi>{args.name}</bdi>?
      </>
    ),
    body: 'This ends its access to your account. The app may keep what it already read. Remove the connector in the app too.',
    confirmLabel: 'Disconnect app',
    onConfirm: args.onConfirm
  })
}
