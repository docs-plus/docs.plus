import { supabaseClient } from '@utils/supabase'

import { conversionErrorMessage, NETWORK_ERROR_MESSAGE } from './conversionErrors'
import type { ExportFormat } from './types'

/** The server slugifies before it writes the header, so the quoted form is the only one we can meet. */
const filenameFrom = (disposition: string | null): string | null =>
  disposition?.match(/filename="([^"]+)"/)?.[1] ?? null

/** Only reached when the header is unreadable; a raw title can carry slashes and dots. */
const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

const save = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Safari reads the blob after the click returns, so the URL cannot be revoked synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Downloads the document in `format`. Renders from the last saved snapshot, not
 * the live editor. Rejects with a message written for the person who clicked.
 */
export const exportDocument = async (
  documentId: string,
  format: ExportFormat,
  fallbackName: string
): Promise<void> => {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession()

  let response: Response
  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}/export?format=${format}`,
      { headers: session?.access_token ? { token: session.access_token } : {} }
    )
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE)
  }

  if (!response.ok) throw new Error(conversionErrorMessage(response.status))

  save(
    await response.blob(),
    filenameFrom(response.headers.get('Content-Disposition')) ||
      `${slugify(fallbackName) || 'document'}.${format}`
  )
}
