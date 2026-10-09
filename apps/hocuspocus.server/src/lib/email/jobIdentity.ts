// Pure, so an import opens no Redis socket.
export const EMAIL_QUEUE_NAME = 'email-notifications'
export const EMAIL_DLQ_NAME = 'email-notifications-dlq'

/** The EmailSentLog key. Its format must not change: old rows still dedupe a retry. */
export const sentLogKey = (jobId: string): string => `email:${jobId}`

/** Namespaced by host, so staging and prod never share a provider key. */
export const providerIdempotencyKey = (namespace: string, id: string): string =>
  `${namespace}/email/${id}`

/** A send with no job never retries, so its key only has to be unique. */
export const inlineIdempotencyKey = (namespace: string, id: string): string =>
  `${namespace}/inline/${id}`
