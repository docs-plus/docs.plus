import { openMakePrivateConfirm } from '@components/settings/openMakePrivateConfirm'
import {
  type DocumentAccessField,
  type DocumentAccessPatch,
  patchDocumentAccess
} from '@hooks/patchDocumentAccess'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

export type { DocumentAccessField }

/** Deep access-mutation module: confirm Private ON, pending, optimistic patch. */
export function useDocumentAccessMutation(args: {
  documentId: string
  userId?: string
  isPrivate: boolean
  readOnly: boolean
}) {
  const { documentId, userId, isPrivate, readOnly } = args
  const { mutate } = useUpdateDocMetadata()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<DocumentAccessField | null>(null)
  const [confirmingPrivate, setConfirmingPrivate] = useState(false)

  const applyPatch = useCallback(
    (patch: DocumentAccessPatch, pendingField: DocumentAccessField) => {
      setPending(pendingField)
      patchDocumentAccess({
        documentId,
        patch,
        mutate,
        queryClient,
        userId,
        onSettled: () => setPending(null)
      })
    },
    [documentId, mutate, queryClient, userId]
  )

  const setPrivate = useCallback(
    (next: boolean) => {
      if (next) {
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
