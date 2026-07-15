import { openMakePrivateConfirm } from '@components/settings/openMakePrivateConfirm'
import { type DocumentAccessField, patchDocumentAccess } from '@hooks/patchDocumentAccess'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

export type { DocumentAccessField }

/** Deep access-mutation module: confirm Private ON, pending, optimistic patch. */
export function useDocumentAccessMutation(args: { documentId: string; userId?: string }) {
  const { documentId, userId } = args
  const { mutate } = useUpdateDocMetadata()
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<DocumentAccessField | null>(null)
  const [confirmingPrivate, setConfirmingPrivate] = useState(false)

  const patch = useCallback(
    (field: DocumentAccessField, value: boolean) => {
      setPending(field)
      patchDocumentAccess({
        documentId,
        field,
        value,
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
          onConfirm: () => patch('isPrivate', true),
          onDismiss: () => setConfirmingPrivate(false)
        })
        return
      }
      patch('isPrivate', false)
    },
    [patch]
  )

  const setReadOnly = useCallback((next: boolean) => patch('readOnly', next), [patch])

  const isControlDisabled = useCallback(
    (field: DocumentAccessField) => confirmingPrivate || pending === field,
    [confirmingPrivate, pending]
  )

  return { setPrivate, setReadOnly, pending, confirmingPrivate, isControlDisabled }
}
