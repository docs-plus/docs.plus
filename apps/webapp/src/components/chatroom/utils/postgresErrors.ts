/**
 * SQLSTATE 23505 on the messages PK means the row IS persisted: an earlier
 * INSERT landed but the client never saw the 2xx (sleep, proxy, network blip),
 * so the optimistic flow treats it as success and lets the realtime echo
 * reconcile. Some wrappers keep only the body, hence the `duplicate key` match.
 */
export const isDuplicateKeyError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  if (code === '23505') return true
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && /duplicate key/i.test(message)
}
