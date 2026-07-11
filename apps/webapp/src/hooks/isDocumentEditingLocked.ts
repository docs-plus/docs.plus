import { authStore, useStore, type Workspace } from '@stores'

/**
 * The single "editing is durably locked for this client" policy: the content-fork
 * freeze (onContentError → providerStatus 'error'), a server read-only scope, or
 * the SSR read-only signal for a non-owner. Consumed two ways — as a store
 * selector (reactive, in useEditorEditableState) and via the imperative
 * isDocumentEditingLocked() below (event handlers gating a setEditable(true)).
 */
export const selectDocumentEditingLocked = (settings: Workspace, profileId?: string): boolean => {
  if (settings.providerStatus === 'error') return true
  if (settings.hocuspocusProvider?.authorizedScope === 'readonly') return true

  const ownerId = settings.metadata?.ownerId
  return settings.metadata?.readOnly === true && ownerId != null && ownerId !== profileId
}

export const isDocumentEditingLocked = (): boolean =>
  selectDocumentEditingLocked(useStore.getState().settings, authStore.getState().profile?.id)
