import type { FaceSource } from '@utils/avatarFace'
import type { DocumentOwnerFields } from '@utils/isDocumentOwner'

/** The fields the client reads from the slug read. An ownerless document has a null
 *  owner profile. A draft has no row yet, so it sends keywords as `''`. */
type DocumentData = DocumentOwnerFields & {
  documentId: string
  slug: string
  title: string
  description?: string
  keywords?: string[] | string
  isPrivate: boolean
  readOnly?: boolean
  ownerProfile?: (FaceSource & { default_avatar_url?: string | null }) | null
  /** Present only when the pad has a social preview card. */
  card?: DocumentCard
}

/** What REST resolved for the page head. `query` is the image query string, `v` included. */
export interface DocumentCard {
  query: string
  /** `og:title`, or null to keep the Pad title. */
  title: string | null
  alt: string
  /** `og:url` path. */
  path: string
}

interface DocumentResponse {
  data: DocumentData
}

interface Session {
  user: {
    id: string
  }
  access_token?: string
}

/** The open document's metadata: the slug read plus its client id. */
export type DocumentMetadata = Omit<DocumentData, 'keywords'> & {
  keywords: string[]
  docClientId: string
}

interface DocumentFetchErrorOptions {
  status?: number
  originalError?: Error
  access?: string
  code?: string
}

export class DocumentFetchError extends Error {
  status?: number
  originalError?: Error
  access?: string
  code?: string

  constructor(message: string, options: DocumentFetchErrorOptions = {}) {
    super(message)
    this.name = 'DocumentFetchError'
    this.status = options.status
    this.originalError = options.originalError
    this.access = options.access
    this.code = options.code
  }
}

/** @param cardQuery The link's card sub-ids with `card=1`, sent only for a full page load. */
export async function fetchDocument(
  slug: string | undefined,
  session?: Session | null,
  cardQuery?: URLSearchParams
): Promise<DocumentMetadata | null> {
  if (!slug?.trim()) return null

  const isServer = typeof window === 'undefined'
  const apiBaseUrl = isServer
    ? process.env.SERVER_RESTAPI_URL || process.env.NEXT_PUBLIC_RESTAPI_URL
    : process.env.NEXT_PUBLIC_RESTAPI_URL

  if (!apiBaseUrl) throw new DocumentFetchError('API URL not configured')

  try {
    const params = new URLSearchParams(cardQuery)
    if (session?.user?.id) params.set('userId', session.user.id)
    const search = params.toString()
    const url = `${apiBaseUrl}/documents/${encodeURIComponent(slug)}${search ? `?${search}` : ''}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (session?.access_token) {
      headers.token = session.access_token
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      headers,
      method: 'GET',
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId))

    if (!response.ok) {
      // Read the body once: the private-doc 403 carries a top-level `access` hint the
      // slug gate maps to a CTA variant, and `error.code` tells a degraded backend
      // (AUTH_UNAVAILABLE) apart from a Traefik 503, whose HTML body carries no code.
      const body = await response.json().catch(() => null)
      const code = typeof body?.error?.code === 'string' ? body.error.code : undefined

      if (response.status === 403) {
        throw new DocumentFetchError('Document is private', {
          status: 403,
          access: body?.access,
          code
        })
      }
      throw new DocumentFetchError(`Failed to fetch document: ${response.statusText}`, {
        status: response.status,
        code
      })
    }

    const responseData: DocumentResponse = await response.json()

    if (!responseData?.data) return null

    const { data } = responseData

    if (!data.documentId || typeof data.isPrivate !== 'boolean') {
      throw new DocumentFetchError('Invalid document data received')
    }

    const visibility = data.isPrivate ? 'private' : 'public'
    const docClientId = `${visibility}.${data.documentId}`

    return {
      ...data,
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      docClientId
    }
  } catch (error) {
    if (error instanceof DocumentFetchError) {
      throw error
    }

    throw new DocumentFetchError('Network error while fetching document', {
      originalError: error instanceof Error ? error : new Error(String(error))
    })
  }
}
