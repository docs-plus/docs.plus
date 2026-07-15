import { authStore, useStore } from '@stores'

import { exitPrivateDocument } from './exitPrivateDocument'

type AccessStatelessPayload = {
  type?: string
  state?: boolean
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
  const ownerId = metadata?.ownerId
  const profileId = authStore.getState().profile?.id
  if (ownerId && profileId === ownerId) return

  exitPrivateDocument({ slug, stopReconnect, destroyProvider })
}
