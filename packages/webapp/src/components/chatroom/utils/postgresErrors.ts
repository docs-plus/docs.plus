/**
 * True if the error is a Postgres unique-violation on the messages PK.
 *
 * This case is special in the optimistic flow: it means the row IS in
 * the database — a prior INSERT actually persisted, but the client never
 * saw the 2xx (browser sleep, aggressive proxy, network blip on
 * acknowledgement). Callers should treat this as success and let the
 * realtime echo reconcile canonical fields.
 *
 * Postgres returns SQLSTATE `23505` for unique violations. PostgREST
 * surfaces it on `error.code`; some error wrappers only preserve the
 * message body, so we also string-match `"duplicate key"`.
 */
export const isDuplicateKeyError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  if (code === '23505') return true
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && /duplicate key/i.test(message)
}
