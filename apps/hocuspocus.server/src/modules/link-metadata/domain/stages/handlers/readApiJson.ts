import { readCappedBody } from '../../../../../lib/readCappedBody'
import { API_BODY_MAX_BYTES } from '../../types'

/**
 * An API body under the byte cap, parsed. Null for no body, an over-cap body or bad JSON: each
 * is a lasting miss. It never checks the status, so a caller can read an error body.
 */
export const readApiJson = async <T>(
  response: Response,
  hop: AbortController
): Promise<T | null> => {
  const body = await readCappedBody(response, hop, API_BODY_MAX_BYTES)
  if (!body) return null
  try {
    return JSON.parse(body.toString('utf8')) as T
  } catch {
    return null
  }
}
