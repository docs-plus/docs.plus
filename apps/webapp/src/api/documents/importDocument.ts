import { supabaseClient } from '@utils/supabase'

import { conversionErrorMessage, NETWORK_ERROR_MESSAGE } from './conversionErrors'
import type { ImportedDocument } from './types'

/**
 * Converts a Word or Markdown upload to editor content. Writes nothing — the
 * caller decides whether to apply the result, which is what lets the UI show
 * the losses before the document is replaced.
 */
export const importDocument = async (documentId: string, file: File): Promise<ImportedDocument> => {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession()

  const body = new FormData()
  body.append('documentFile', file)

  let response: Response
  try {
    response = await fetch(
      `${process.env.NEXT_PUBLIC_RESTAPI_URL}/documents/${documentId}/import`,
      {
        method: 'POST',
        body,
        headers: session?.access_token ? { token: session.access_token } : {}
      }
    )
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE)
  }

  if (!response.ok) throw new Error(conversionErrorMessage(response.status))

  const payload = await response.json()
  if (!payload?.success) throw new Error(conversionErrorMessage(response.status))
  return payload.data as ImportedDocument
}
