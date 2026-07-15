import { useStore } from '@stores'

/** Tear down collab and hard-nav so SSR PrivateDocumentGate mounts for a sealed peer. */
export function exitPrivateDocument(args: {
  slug: string
  stopReconnect: () => void
  destroyProvider: () => void
}): void {
  args.stopReconnect()
  args.destroyProvider()
  useStore.getState().setWorkspaceSetting('hocuspocusProvider', null)
  window.location.assign(`/${args.slug}`)
}
