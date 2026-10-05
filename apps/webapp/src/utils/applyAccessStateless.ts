import { authStore, useStore } from '@stores'

import { adoptOwner } from './adoptOwner'
import { exitSealedDocument } from './exitSealedDocument'

type AccessStatelessPayload = {
  type?: string
  state?: boolean
  ownerId?: string | null
}

/** Apply a live access payload: patch metadata, kick peers on Private/Deleted ON. The
 *  owner arm names the signed-in person whose first edit created the row. */
export function applyAccessStateless(args: {
  documentId: string
  slug: string
  data: AccessStatelessPayload
  stopReconnect: () => void
  destroyProvider: () => void
}): void {
  const { documentId, slug, data, stopReconnect, destroyProvider } = args
  if (data.type === 'deleted' && data.state === true) {
    // Home, not `/${slug}`: after a purge the slug resolves to nothing, and
    // opening an unknown slug is the document-creation path.
    exitSealedDocument({ to: '/', stopReconnect, destroyProvider })
    return
  }

  if (data.type === 'owner') {
    if (typeof data.ownerId === 'string') adoptOwner(documentId, data.ownerId)
    return
  }
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
  // Prefer the event's ownerId, fresh at seal time, over store metadata, which
  // can be stale for long-open tabs. The server's connection close is the
  // enforcement either way, and this only drives the redirect UX.
  const ownerId = data.ownerId !== undefined ? data.ownerId : metadata?.ownerId
  const profileId = authStore.getState().profile?.id
  if (ownerId && profileId === ownerId) return

  exitSealedDocument({ to: `/${slug}`, stopReconnect, destroyProvider })
}
