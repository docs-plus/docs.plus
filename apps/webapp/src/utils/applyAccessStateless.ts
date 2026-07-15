import { authStore, useStore } from '@stores'

import { exitPrivateDocument } from './exitPrivateDocument'

type AccessStatelessPayload = {
  type?: string
  state?: boolean
  ownerId?: string | null
}

/** Apply a live access seal payload: patch metadata, kick non-owners on Private ON. */
export function applyAccessStateless(args: {
  documentId: string
  slug: string
  data: AccessStatelessPayload
  stopReconnect: () => void
  destroyProvider: () => void
}): void {
  const { documentId, slug, data, stopReconnect, destroyProvider } = args
  if (data.type !== 'readOnly' && data.type !== 'private') return

  const { settings, setWorkspaceSetting } = useStore.getState()
  const metadata = settings.metadata
  if (metadata?.documentId === documentId) {
    const next =
      data.type === 'readOnly'
        ? { ...metadata, readOnly: Boolean(data.state) }
        : { ...metadata, isPrivate: Boolean(data.state) }
    setWorkspaceSetting('metadata', next)
  }

  if (data.type !== 'private' || data.state !== true) return
  // Prefer the event's ownerId — fresh at seal time — over store metadata,
  // which can be stale for long-open tabs; the server's connection close is
  // the enforcement either way, this only drives the redirect UX.
  const ownerId = data.ownerId !== undefined ? data.ownerId : metadata?.ownerId
  const profileId = authStore.getState().profile?.id
  if (ownerId && profileId === ownerId) return

  exitPrivateDocument({ slug, stopReconnect, destroyProvider })
}
