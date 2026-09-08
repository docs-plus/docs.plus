import * as toast from '@components/toast'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import { useStore } from '@stores'
import { plainTitle, sendDocTitleStateless } from '@utils/titleWrite'
import { useCallback } from 'react'

import type { DocumentsListScope } from '../documentsQueryKey'
import { useOwnerDocumentsCache } from './documentsCache'

/**
 * Optimistic title patch shared by the list inline-rename and the grid rename dialog.
 * `commit` resolves to `false` when the trimmed title is empty or unchanged (no PUT
 * sent), so callers can close/exit without waiting. Otherwise the mutation drives `isPending`.
 */
const useCommitDocumentRename = (scope: DocumentsListScope) => {
  const cache = useOwnerDocumentsCache(scope)
  const { mutate, isPending } = useUpdateDocMetadata()

  const commit = useCallback(
    async (
      documentId: string,
      currentTitle: string | null,
      nextTitle: string,
      options?: { onSettled?: () => void }
    ): Promise<boolean> => {
      const trimmed = plainTitle(nextTitle.trim())
      if (!trimmed || trimmed === plainTitle(currentTitle ?? '')) return false

      const rollback = await cache.patchDocument(documentId, { title: trimmed })

      // Owner-scoped PUT of the title only (slug is immutable); optimistic patch above.
      mutate(
        { documentId, title: trimmed },
        {
          onSuccess: (responseData) => {
            const { settings, setWorkspaceSetting } = useStore.getState()
            const openId = settings.metadata?.documentId
            if (!openId || documentId !== openId) return

            const next = plainTitle(responseData.title ?? '')
            setWorkspaceSetting('metadata', { ...settings.metadata, title: next })
            sendDocTitleStateless(settings.hocuspocusProvider, next)
          },
          onError: () => {
            rollback?.()
            toast.Error('Couldn’t rename document')
          },
          onSettled: () => options?.onSettled?.()
        }
      )
      return true
    },
    [cache, mutate]
  )

  return { commit, isPending }
}

export default useCommitDocumentRename
