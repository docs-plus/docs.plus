import SignOutConfirmDialog from '@components/settings/components/SignOutConfirmDialog'
import { useStore } from '@stores'
import { createElement } from 'react'

/** Opens the shared sign-out confirm; sign-out only proceeds through `onConfirm`. */
export function openSignOutConfirm(args: { onConfirm: () => void }): void {
  useStore
    .getState()
    .openDialog(createElement(SignOutConfirmDialog, { onConfirm: args.onConfirm }), {
      size: 'sm'
    })
}
