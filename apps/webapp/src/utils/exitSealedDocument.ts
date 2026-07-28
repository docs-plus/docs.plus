import { useStore } from '@stores'

/** Tear down collab and hard-nav so SSR re-decides access for a sealed peer. */
export function exitSealedDocument(args: {
  to: string
  stopReconnect: () => void
  destroyProvider: () => void
}): void {
  args.stopReconnect()
  args.destroyProvider()
  useStore.getState().setWorkspaceSetting('hocuspocusProvider', null)
  window.location.assign(args.to)
}
