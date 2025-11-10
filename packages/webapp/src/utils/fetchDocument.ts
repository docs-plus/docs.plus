interface DocumentData {
  documentId: string
  title: string
  description?: string
  slug: string
  isPrivate: boolean
  [key: string]: any
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

interface DocumentWithClientId extends DocumentData {
  docClientId: string
}

class DocumentFetchError extends Error {
  constructor(
    message: string,
    public status?: number,
    public originalError?: Error
  ) {
    super(message)
    this.name = 'DocumentFetchError'
  }
}

export async function fetchDocument(
  slug: string | undefined,
  session?: Session | null
): Promise<DocumentWithClientId | null> {
  if (!slug?.trim()) return null

  // Use server URL for SSR, client URL for browser
  const isServer = typeof window === 'undefined'
  const apiBaseUrl = isServer
    ? process.env.SERVER_RESTAPI_URL || process.env.NEXT_PUBLIC_RESTAPI_URL
    : process.env.NEXT_PUBLIC_RESTAPI_URL

  if (!apiBaseUrl) throw new DocumentFetchError('API URL not configured')

  try {
    const baseAPIUrl = `${apiBaseUrl}/documents/${encodeURIComponent(slug)}`
    const url = session?.user?.id
      ? `${baseAPIUrl}?userId=${encodeURIComponent(session.user.id)}`
      : baseAPIUrl

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (session?.access_token) {
      headers.token = session.access_token
    }

    // Add timeout to prevent hanging requests
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(url, {
      headers,
      method: 'GET',
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId))

    if (!response.ok) {
      throw new DocumentFetchError(
        `Failed to fetch document: ${response.statusText}`,
        response.status
      )
    }

    const responseData: DocumentResponse = await response.json()

    if (!responseData?.data) return null

    const { data } = responseData

    // Validate required fields
    if (!data.documentId || typeof data.isPrivate !== 'boolean') {
      throw new DocumentFetchError('Invalid document data received')
    }

    const visibility = data.isPrivate ? 'private' : 'public'
    const docClientId = `${visibility}.${data.documentId}`

    return {
      ...data,
      docClientId
    }
  } catch (error) {
    if (error instanceof DocumentFetchError) {
      throw error
    }

    throw new DocumentFetchError(
      'Network error while fetching document',
      undefined,
      error instanceof Error ? error : new Error(String(error))
    )
  }
}
