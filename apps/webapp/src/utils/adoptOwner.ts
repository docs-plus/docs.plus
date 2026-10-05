import { authStore, useStore } from '@stores'

/** Make `ownerId` the open pad's owner, so owner controls show without a reload. Only
 *  the viewer's own profile is known here, so a peer's "Owned by" fills on reload. */
export function adoptOwner(documentId: string, ownerId: string): void {
  const { settings, setWorkspaceSetting } = useStore.getState()
  const metadata = settings.metadata
  if (metadata?.documentId !== documentId || metadata.ownerId === ownerId) return

  const profile = authStore.getState().profile
  const ownerProfile = profile?.id === ownerId ? profile : metadata.ownerProfile
  setWorkspaceSetting('metadata', { ...metadata, ownerId, ownerProfile })
}
