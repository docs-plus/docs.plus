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

export type DocumentAccessPatch = {
  isPrivate?: boolean
  readOnly?: boolean
}

export type PatchDocumentAccessArgs = {
  documentId: string
  patch: DocumentAccessPatch
  mutate: UseMutateFunction<UpdateDocMetadataResponse, Error, UpdateDocMetadataParams, unknown>
  /** When set, optimistic-patches every `['documents', userId, …]` infinite query. */
  queryClient?: QueryClient
  userId?: string
  onSettled?: () => void
}

function applySuccessToast(patch: DocumentAccessPatch): void {
  if (patch.isPrivate !== undefined) {
    toast.Success(patch.isPrivate ? 'Document is now private' : 'Document is now public')
    return
  }
  toast.Success('Read-only status updated')
}

function applyAccessFields<T extends { isPrivate?: boolean; readOnly?: boolean }>(
  row: T,
  patch: DocumentAccessPatch
): T {
  return {
    ...row,
    ...(patch.isPrivate !== undefined ? { isPrivate: patch.isPrivate } : {}),
    ...(patch.readOnly !== undefined ? { readOnly: patch.readOnly } : {})
  }
}

function patchWorkspaceMetadataAccess(documentId: string, patch: DocumentAccessPatch) {
  const { settings, setWorkspaceSetting } = useStore.getState()
  const metadata = settings.metadata
  if (!metadata?.documentId || metadata.documentId !== documentId) return null
  const previous = metadata
  setWorkspaceSetting('metadata', applyAccessFields(metadata, patch))
  return previous
}

function patchOwnedDocumentInPages(
  data: InfiniteData<DocumentsPage>,
  documentId: string,
  patch: DocumentAccessPatch
): InfiniteData<DocumentsPage> {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      docs: page.docs.map((d) => (d.documentId === documentId ? applyAccessFields(d, patch) : d))
    }))
  }
}

/** Optimistic access patch shared by Settings soft well and Documents ⋮. */
export function patchDocumentAccess({
  documentId,
  patch,
  mutate,
  queryClient,
  userId,
  onSettled
}: PatchDocumentAccessArgs): void {
  if (patch.isPrivate === undefined && patch.readOnly === undefined) return

  void (async () => {
    type ListSnapshot = [QueryKey, InfiniteData<DocumentsPage> | undefined]
    let listSnapshots: ListSnapshot[] = []

    if (queryClient && userId) {
      const filter = { queryKey: ['documents', userId] as const }
      await queryClient.cancelQueries(filter)
      listSnapshots = queryClient.getQueriesData<InfiniteData<DocumentsPage>>(filter)
      for (const [key, data] of listSnapshots) {
        if (!data) continue
        queryClient.setQueryData(key, patchOwnedDocumentInPages(data, documentId, patch))
      }
    }

    const metadataSnapshot = patchWorkspaceMetadataAccess(documentId, patch)

    mutate(
      { documentId, ...patch },
      {
        onSuccess: () => applySuccessToast(patch),
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
