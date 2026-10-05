import { useOwnerDocumentsCache } from '@components/settings/hooks/documentsCache'
import { openMakePrivateConfirm } from '@components/settings/openMakePrivateConfirm'
import * as toast from '@components/toast'
import {
  accessSuccessToast,
  type DocumentAccessField,
  type DocumentAccessPatch,
  patchWorkspaceMetadataAccess
} from '@hooks/patchDocumentAccess'
import { putDocumentMetadata, type UpdateDocMetadataResponse } from '@hooks/useUpdateDocMetadata'
import { onlineManager, useMutation, useMutationState } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

export type { DocumentAccessField }

type AccessWrite = { documentId: string; patch: DocumentAccessPatch; field: DocumentAccessField }

const accessKey = (documentId: string) => ['documentAccess', documentId] as const

// Access flips never queue offline: a Private or Read-only change must land now or not at all.
function refuseOffline(): boolean {
  if (onlineManager.isOnline()) return false
  toast.Error('You are offline. This change was not saved.')
  return true
}

/**
 * Private and Read-only for one document. The optimistic patch, its rollback and the toasts
 * are hook-level, and the pending field is read from the mutation cache. So a write outlives
 * the ⋮ menu or phone sheet that started it, and a reopened menu still sees it in flight.
 */
export function useDocumentAccessMutation(args: {
  documentId: string
  userId?: string
  isPrivate: boolean
  readOnly: boolean
}) {
  const { documentId, userId, isPrivate, readOnly } = args
  const cache = useOwnerDocumentsCache(userId ?? '')
  const [confirmingPrivate, setConfirmingPrivate] = useState(false)

  const { mutate } = useMutation<
    UpdateDocMetadataResponse,
    Error,
    AccessWrite,
    { rollback: () => void }
  >({
    mutationKey: accessKey(documentId),
    mutationFn: ({ documentId, patch }) => putDocumentMetadata({ documentId, ...patch }),
    onMutate: async ({ documentId, patch }) => {
      const listRollback = userId ? await cache.patchDocument(documentId, patch) : null
      const metadataRollback = patchWorkspaceMetadataAccess(documentId, patch)
      return {
        rollback: () => {
          listRollback?.()
          metadataRollback?.()
        }
      }
    },
    onSuccess: (_data, { patch }) => accessSuccessToast(patch),
    onError: (_error, _variables, context) => {
      context?.rollback()
      toast.Error("Couldn't update document settings")
    }
  })

  const pending =
    useMutationState({
      filters: { mutationKey: accessKey(documentId), status: 'pending' },
      select: (mutation) => (mutation.state.variables as AccessWrite).field
    }).at(-1) ?? null

  const applyPatch = useCallback(
    (patch: DocumentAccessPatch, field: DocumentAccessField) => {
      if (refuseOffline()) return
      mutate({ documentId, patch, field })
    },
    [documentId, mutate]
  )

  const setPrivate = useCallback(
    (next: boolean) => {
      if (next) {
        if (refuseOffline()) return
        setConfirmingPrivate(true)
        openMakePrivateConfirm({
          // Private seals the room — clear Read-only so the pair can't both stay on.
          onConfirm: () =>
            applyPatch({ isPrivate: true, ...(readOnly ? { readOnly: false } : {}) }, 'isPrivate'),
          onDismiss: () => setConfirmingPrivate(false)
        })
        return
      }
      applyPatch({ isPrivate: false }, 'isPrivate')
    },
    [applyPatch, readOnly]
  )

  const setReadOnly = useCallback(
    (next: boolean) => {
      if (isPrivate) return
      applyPatch({ readOnly: next }, 'readOnly')
    },
    [applyPatch, isPrivate]
  )

  const isControlDisabled = useCallback(
    (field: DocumentAccessField) => {
      if (confirmingPrivate) return true
      if (field === 'readOnly' && isPrivate) return true
      return pending === field
    },
    [confirmingPrivate, isPrivate, pending]
  )

  return { setPrivate, setReadOnly, pending, confirmingPrivate, isControlDisabled }
}
