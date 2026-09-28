import DisconnectAppDialog from '@components/settings/components/DisconnectAppDialog'
import { useStore } from '@stores'
import { createElement } from 'react'

/** Opens the Disconnect confirm; the revoke only runs through `onConfirm`. */
export function openDisconnectAppConfirm(args: { name: string; onConfirm: () => void }): void {
  useStore
    .getState()
    .openDialog(
      createElement(DisconnectAppDialog, { name: args.name, onConfirm: args.onConfirm }),
      {
        size: 'sm'
      }
    )
}
