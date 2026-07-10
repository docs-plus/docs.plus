import * as toast from '@components/toast'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import { type InfiniteData, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { makeDocumentsKey } from '../documentsQueryKey'
import type { DocumentSortKey, DocumentsPage } from '../types'

/**
 * Optimistic title patch shared by the list inline-rename and the grid rename dialog.
 * `commit` resolves to `false` when the trimmed title is empty or unchanged (no PUT sent),
 * so callers can close/exit without waiting; otherwise the mutation drives `isPending`.
 */
const useCommitDocumentRename = (userId: string, searchQuery: string, sortKey: DocumentSortKey) => {
  const queryClient = useQueryClient()
  const { mutate, isPending } = useUpdateDocMetadata()

  const commit = useCallback(
    async (
      documentId: string,
      currentTitle: string | null,
      nextTitle: string,
      options?: { onSettled?: () => void }
    ): Promise<boolean> => {
      const trimmed = nextTitle.trim()
      if (!trimmed || trimmed === (currentTitle ?? '')) return false

      const key = makeDocumentsKey(userId, searchQuery, sortKey)
      // Cancel in-flight refetches or a focus refetch resolving after this patch reverts it.
      await queryClient.cancelQueries({ queryKey: key })
      const snapshot = queryClient.getQueryData<InfiniteData<DocumentsPage>>(key)
      if (snapshot) {
        queryClient.setQueryData(key, {
          ...snapshot,
          pages: snapshot.pages.map((page) => ({
            ...page,
            docs: page.docs.map((d) => (d.documentId === documentId ? { ...d, title: trimmed } : d))
          }))
        })
      }

      // Owner-scoped PUT of the title only (slug is immutable); optimistic patch above.
      mutate(
        { documentId, title: trimmed },
        {
          onError: () => {
            if (snapshot) queryClient.setQueryData(key, snapshot)
            toast.Error('Couldn’t rename document')
          },
          onSettled: () => options?.onSettled?.()
        }
      )
      return true
    },
    [userId, searchQuery, sortKey, queryClient, mutate]
  )

  return { commit, isPending }
}

export default useCommitDocumentRename
