import type { DocumentsPage } from '@components/settings/types'
import * as toast from '@components/toast'
import type {
  UpdateDocMetadataParams,
  UpdateDocMetadataResponse
} from '@hooks/useUpdateDocMetadata'
import { useStore } from '@stores'
import {
  type InfiniteData,
  type QueryClient,
  type QueryKey,
  type UseMutateFunction
} from '@tanstack/react-query'

export type DocumentAccessField = 'isPrivate' | 'readOnly'

export type PatchDocumentAccessArgs = {
  documentId: string
  field: DocumentAccessField
  value: boolean
  mutate: UseMutateFunction<UpdateDocMetadataResponse, Error, UpdateDocMetadataParams, unknown>
  /** When set, optimistic-patches every `['documents', userId, …]` infinite query. */
  queryClient?: QueryClient
  userId?: string
  onSettled?: () => void
}

function applySuccessToast(field: DocumentAccessField, value: boolean): void {
  if (field === 'isPrivate') {
    toast.Success(value ? 'Document is now private' : 'Document is now public')
    return
  }
  toast.Success('Read-only status updated')
}

function patchWorkspaceMetadataAccess(
  documentId: string,
  field: DocumentAccessField,
  value: boolean
) {
  const { settings, setWorkspaceSetting } = useStore.getState()
  const metadata = settings.metadata
  if (!metadata?.documentId || metadata.documentId !== documentId) return null
  const previous = metadata
  setWorkspaceSetting('metadata', { ...metadata, [field]: value })
  return previous
}

function patchOwnedDocumentInPages(
  data: InfiniteData<DocumentsPage>,
  documentId: string,
  field: DocumentAccessField,
  value: boolean
): InfiniteData<DocumentsPage> {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      docs: page.docs.map((d) => (d.documentId === documentId ? { ...d, [field]: value } : d))
    }))
  }
}

/** Optimistic access patch shared by Settings soft well and Documents ⋮. */
export function patchDocumentAccess({
  documentId,
  field,
  value,
  mutate,
  queryClient,
  userId,
  onSettled
}: PatchDocumentAccessArgs): void {
  void (async () => {
    type ListSnapshot = [QueryKey, InfiniteData<DocumentsPage> | undefined]
    let listSnapshots: ListSnapshot[] = []

    if (queryClient && userId) {
      const filter = { queryKey: ['documents', userId] as const }
      await queryClient.cancelQueries(filter)
      listSnapshots = queryClient.getQueriesData<InfiniteData<DocumentsPage>>(filter)
      for (const [key, data] of listSnapshots) {
        if (!data) continue
        queryClient.setQueryData(key, patchOwnedDocumentInPages(data, documentId, field, value))
      }
    }

    const metadataSnapshot = patchWorkspaceMetadataAccess(documentId, field, value)

    mutate(
      { documentId, [field]: value },
      {
        onSuccess: () => applySuccessToast(field, value),
        onError: () => {
          if (queryClient) {
            for (const [key, data] of listSnapshots) {
              queryClient.setQueryData(key, data)
            }
          }
          if (metadataSnapshot) {
            useStore.getState().setWorkspaceSetting('metadata', metadataSnapshot)
          }
          toast.Error("Couldn't update document settings")
        },
        onSettled: () => onSettled?.()
      }
    )
  })()
}
