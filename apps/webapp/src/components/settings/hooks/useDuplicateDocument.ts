import * as toast from '@components/toast'
import { padUrl } from '@services/padUrl'
import { useMutation } from '@tanstack/react-query'
import { supabaseClient } from '@utils/supabase'

import { useOwnerDocumentsCache } from './documentsCache'

// The backend resets isPrivate and readOnly, and returns only these three fields.
export interface DuplicatedDocument {
  documentId: string
  slug: string
  title: string
}

const parseRetryAfterSeconds = (header?: string | null): number | null => {
  const trimmed = header?.trim()
  if (!trimmed) return null
  const seconds = Number(trimmed)
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null
}

export function duplicateErrorMessage(
  status: number,
  code?: string,
  retryAfterHeader?: string | null
): string {
  const retryAfter = parseRetryAfterSeconds(retryAfterHeader)

  if (status === 429 || code === 'RATE_LIMIT_EXCEEDED') {
    if (retryAfter === null) {
      return 'You’ve duplicated too many documents. Try again in a few minutes.'
    }
    if (retryAfter >= 60) {
      const mins = Math.ceil(retryAfter / 60)
      return `You’ve duplicated too many documents. Try again in ${mins} ${mins === 1 ? 'minute' : 'minutes'}.`
    }
    return `You’ve duplicated too many documents. Try again in ${retryAfter} ${retryAfter === 1 ? 'second' : 'seconds'}.`
  }

  if (status === 503 || code === 'SERVICE_UNAVAILABLE') {
    if (retryAfter !== null) {
      return `The server is busy right now. Try again in ${retryAfter} ${retryAfter === 1 ? 'second' : 'seconds'}.`
    }
    return 'The server is busy right now. Try again in a moment.'
  }

  switch (status) {
    case 401:
      return 'Your session has expired. Reload the page and sign in again.'
    case 403:
      return 'You don’t have permission to duplicate this document.'
    case 404:
      return 'This document is no longer available.'
    case 413:
      return 'This document has too many media files to duplicate.'
    default:
      return 'Couldn’t duplicate document'
  }
}

export class DuplicateError extends Error {
  readonly status: number
  readonly code?: string
  readonly retryAfter?: string | null

  constructor(status: number, code?: string, retryAfter?: string | null) {
    super(duplicateErrorMessage(status, code, retryAfter))
    this.name = 'DuplicateError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

/**
 * POST /documents/:documentId/duplicate (any readable public/Open document, or owner).
 * The toast and the list refresh are hook-level, so they still run when the ⋮ menu,
 * phone sheet, or document settings popover closes mid-request.
 * `name` rides the variables: hook-level callbacks keep the options of the last render.
 */
const useDuplicateDocument = (userId?: string) => {
  const cache = useOwnerDocumentsCache(userId ?? '')
  const { isPending, mutate } = useMutation<
    DuplicatedDocument,
    Error,
    { documentId: string; name: string },
    { toastId: string }
  >({
    mutationKey: ['duplicateDocument'],
    mutationFn: async ({ documentId }) => {
      const url = `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${encodeURIComponent(documentId)}/duplicate`

      const {
        data: { session }
      } = await supabaseClient.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.token = session.access_token

      const response = await fetch(url, { method: 'POST', headers })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const code = typeof body?.error?.code === 'string' ? body.error.code : undefined
        throw new DuplicateError(response.status, code, response.headers.get('Retry-After'))
      }

      const json = await response.json()
      if (!json.success || !json.data) throw new Error('Invalid duplicate response')
      return json.data as DuplicatedDocument
    },
    onMutate: () => ({ toastId: toast.Loading('Duplicating…') }),
    onSuccess: (copy, { name }, { toastId }) => {
      if (userId) cache.addDuplicate()
      toast.Success(`Copy of “${name}” created`, {
        id: toastId,
        actionLabel: 'Open in new tab',
        onAction: () =>
          window.open(padUrl.link({ kind: 'document', slug: copy.slug }, 'path'), '_blank')
      })
    },
    onError: (error, _variables, context) =>
      toast.Error(error instanceof DuplicateError ? error.message : 'Couldn’t duplicate document', {
        id: context?.toastId
      })
  })

  return { duplicate: mutate, isPending }
}

export default useDuplicateDocument
