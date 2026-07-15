import MakePrivateDialog from '@components/settings/components/MakePrivateDialog'
import { useStore } from '@stores'
import { createElement } from 'react'

/** Opens the shared Private ON confirm; `onDismiss` runs on Cancel/Esc/scrim/unmount. */
export function openMakePrivateConfirm(args: {
  onConfirm: () => void
  onDismiss?: () => void
}): void {
  useStore.getState().openDialog(
    createElement(MakePrivateDialog, {
      onConfirm: args.onConfirm,
      onDismiss: args.onDismiss
    }),
    { size: 'sm' }
  )
}
