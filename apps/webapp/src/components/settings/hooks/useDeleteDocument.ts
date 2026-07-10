import { useMutation } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

// Same `token` header convention as useUpdateDocMetadata — the backend
// strict-owner-gates the soft delete / restore off the Supabase JWT.
const authHeaders = async (): Promise<Record<string, string>> => {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) headers.token = session.access_token
  return headers
}

/**
 * Soft-delete (DELETE) + restore (POST /restore) + permanent purge
 * (DELETE /permanent) for an owned document. Optimistic cache patches live in
 * the component; this hook only fires the calls and surfaces isPending.
 */
const useDeleteDocument = () => {
  const deletion = useMutation<void, Error, { documentId: string }>({
    mutationKey: ['deleteDocument'],
    mutationFn: async ({ documentId }) => {
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}`
      const response = await fetch(url, { method: 'DELETE', headers: await authHeaders() })
      if (!response.ok) throw new Error('Failed to delete document')
    }
  })

  const restoration = useMutation<void, Error, { documentId: string }>({
    mutationKey: ['restoreDocument'],
    mutationFn: async ({ documentId }) => {
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}/restore`
      const response = await fetch(url, { method: 'POST', headers: await authHeaders() })
      if (!response.ok) throw new Error('Failed to restore document')
    }
  })

  // Trash "Delete forever" — the backend refuses a live (non-soft-deleted) doc.
  const permanentDeletion = useMutation<void, Error, { documentId: string }>({
    mutationKey: ['permanentDeleteDocument'],
    mutationFn: async ({ documentId }) => {
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}/permanent`
      const response = await fetch(url, { method: 'DELETE', headers: await authHeaders() })
      if (!response.ok) throw new Error('Failed to permanently delete document')
    }
  })

  // Bulk Trash — purge (no ids = empty all; ids = a selection) + bulk restore.
  // Both return the server's count so callers can toast "Deleted N".
  const bulkPurge = useMutation<{ purged: number }, Error, { ids?: string[] }>({
    mutationKey: ['purgeTrash'],
    mutationFn: async ({ ids }) => {
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/trash/purge`
      const response = await fetch(url, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ ids })
      })
      if (!response.ok) throw new Error('Failed to empty trash')
      return (await response.json()).data
    }
  })

  const bulkRestoration = useMutation<{ restored: number }, Error, { ids: string[] }>({
    mutationKey: ['restoreTrash'],
    mutationFn: async ({ ids }) => {
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/trash/restore`
      const response = await fetch(url, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ ids })
      })
      if (!response.ok) throw new Error('Failed to restore documents')
      return (await response.json()).data
    }
  })

  return {
    deleteDocument: deletion.mutate,
    restoreDocument: restoration.mutate,
    permanentlyDeleteDocument: permanentDeletion.mutate,
    purgeTrash: bulkPurge.mutate,
    bulkRestoreDocuments: bulkRestoration.mutate,
    isPending:
      deletion.isPending ||
      restoration.isPending ||
      permanentDeletion.isPending ||
      bulkPurge.isPending ||
      bulkRestoration.isPending
  }
}

export default useDeleteDocument
