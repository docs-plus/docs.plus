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

/**
 * Whether the current user can post comments on the open document.
 * Stays true on `readOnly = true` documents (commenting stays enabled while
 * editing is locked; Phase 2 #826 will refine this once 4-tier roles exclude
 * `Can view`). Blocked during an unrecoverable provider error / content-fork freeze.
 */
export const selectCanComment = (settings: Workspace): boolean =>
  settings.providerStatus !== 'error'

export const canCommentInDocument = (): boolean => selectCanComment(useStore.getState().settings)
