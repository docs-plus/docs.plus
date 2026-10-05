import * as toast from '@components/toast'
import { useStore } from '@stores'

export type DocumentAccessField = 'isPrivate' | 'readOnly'

export type DocumentAccessPatch = {
  isPrivate?: boolean
  readOnly?: boolean
}

export function accessSuccessToast(patch: DocumentAccessPatch): void {
  if (patch.isPrivate !== undefined) {
    toast.Success(patch.isPrivate ? 'Document is now private' : 'Document is now public')
    return
  }
  toast.Success('Read-only status updated')
}

/** Patches the open pad's metadata when it is this document. The result puts it back. */
export function patchWorkspaceMetadataAccess(
  documentId: string,
  patch: DocumentAccessPatch
): (() => void) | null {
  const { settings, setWorkspaceSetting } = useStore.getState()
  const metadata = settings.metadata
  if (!metadata?.documentId || metadata.documentId !== documentId) return null
  setWorkspaceSetting('metadata', { ...metadata, ...patch })
  return () => useStore.getState().setWorkspaceSetting('metadata', metadata)
}
