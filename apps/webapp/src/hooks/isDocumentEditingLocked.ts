import { authStore, useStore, type Workspace } from '@stores'

/**
 * Durable editing lock: content-fork freeze, mirrored WS `authorizedScope`,
 * or SSR read-only for a non-owner. Used as a store selector and as
 * imperative isDocumentEditingLocked() before setEditable(true).
 */
export const selectDocumentEditingLocked = (settings: Workspace, profileId?: string): boolean => {
  if (settings.providerStatus === 'error') return true
  if (settings.authorizedScope === 'readonly') return true

  const ownerId = settings.metadata?.ownerId
  return settings.metadata?.readOnly === true && ownerId != null && ownerId !== profileId
}

export const isDocumentEditingLocked = (): boolean =>
  selectDocumentEditingLocked(useStore.getState().settings, authStore.getState().profile?.id)
