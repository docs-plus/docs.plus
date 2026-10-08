import * as toast from '@components/toast'
import { useStore } from '@stores'
import { onlineManager, useMutation } from '@tanstack/react-query'
import { adoptOwner } from '@utils/adoptOwner'
import { supabaseClient } from '@utils/supabase'
import { plainTitle, sendDocTitleStateless } from '@utils/titleWrite'

export interface UpdateDocMetadataParams {
  title?: string
  description?: string
  keywords?: string[]
  documentId: string
  readOnly?: boolean
  isPrivate?: boolean
  // URL slug — lets the backend anchor a never-persisted draft under the slug
  // reload resolves by, instead of slugify(title). Consumed only on row create.
  slug?: string
}

export interface UpdateDocMetadataResponse {
  documentId: string
  readOnly: boolean
  isPrivate: boolean
  ownerId?: string | null
  title?: string | null
  description?: string | null
  keywords?: string[] | string | null
}

/** PUT /documents/:documentId. The Title write and the Access mutation both send it. */
export async function putDocumentMetadata({
  title,
  description,
  keywords,
  documentId,
  readOnly,
  isPrivate,
  slug
}: UpdateDocMetadataParams): Promise<UpdateDocMetadataResponse> {
  const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}`

  // Send only defined fields — a default readOnly=false would clobber an owner's lock.
  const body: Partial<UpdateDocMetadataParams> = {}
  if (title !== undefined) body.title = title
  if (description !== undefined) body.description = description
  if (keywords !== undefined) body.keywords = keywords
  if (readOnly !== undefined) body.readOnly = readOnly
  if (isPrivate !== undefined) body.isPrivate = isPrivate
  if (slug !== undefined) body.slug = slug

  // Send the Supabase token so the backend can owner-gate the readOnly/isPrivate flags
  // (same `token` header convention as fetchDocument/uploadMediaFile).
  const {
    data: { session }
  } = await supabaseClient.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) headers.token = session.access_token

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error('Failed to update document metadata')
  }

  const json = await response.json()
  if (!json.success || !json.data) throw new Error('Invalid update response')
  return json.data as UpdateDocMetadataResponse
}

const useUpdateDocMetadata = () => {
  const { isPending, isSuccess, mutate, data } = useMutation<
    UpdateDocMetadataResponse,
    Error,
    UpdateDocMetadataParams
  >({
    mutationKey: ['updateDocumentMetadata'],
    // Offline saves pause and resume on reconnect. One scope runs them in order,
    // so the last title typed is the last one saved.
    scope: { id: 'updateDocumentMetadata' },
    onMutate: () => {
      if (!onlineManager.isOnline()) {
        toast.Warning(
          'You are offline. This change will save when you reconnect. Keep this page open.'
        )
      }
    },
    mutationFn: putDocumentMetadata,
    // Hook-level, so a save queued offline still relays after its dialog unmounts.
    // Documents list uses optimistic updates — do NOT invalidate here (avoids flash).
    onSuccess: (data, { documentId, title }) => {
      // A PUT that creates a draft's row makes a signed-in caller its owner. The
      // first edit then cedes and broadcasts nothing, so the pad learns it here.
      if (data.ownerId) adoptOwner(documentId, data.ownerId)

      if (title === undefined) return
      const { settings, setWorkspaceSetting } = useStore.getState()
      if (settings.metadata?.documentId !== documentId) return

      const next = plainTitle(data.title ?? '')
      setWorkspaceSetting('metadata', { ...settings.metadata, title: next })
      sendDocTitleStateless(settings.hocuspocusProvider)
    }
  })

  return {
    isPending,
    isSuccess,
    mutate,
    data
  }
}

export default useUpdateDocMetadata
