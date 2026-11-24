import { authStore, useStore, type Workspace } from '@stores'

import { isDocumentAccessReadOnly } from './collabSession'

/**
 * Durable editing lock: content-fork freeze, mirrored WS `authorizedScope`,
 * or SSR read-only for a non-owner. Used as a store selector and as
 * imperative isDocumentEditingLocked() before setEditable(true).
 */
export const selectDocumentEditingLocked = (settings: Workspace, profileId?: string): boolean =>
  settings.providerStatus === 'error' || isDocumentAccessReadOnly(settings, profileId)

export const isDocumentEditingLocked = (): boolean =>
  selectDocumentEditingLocked(useStore.getState().settings, authStore.getState().profile?.id)
