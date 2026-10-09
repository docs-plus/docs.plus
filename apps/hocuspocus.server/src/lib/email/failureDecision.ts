// Pure, so a test reaches it without the Redis socket queue.ts opens at import.
import { type EmailErrorKind, EmailSendError } from './providers/types'

export type EmailFailureAction = 'retry' | 'dead-letter'

/** A template or Prisma error is not the provider's verdict, so time may fix it. */
export const emailFailureKind = (err: unknown): EmailErrorKind =>
  err instanceof EmailSendError ? err.kind : 'transient'

/** `attemptsMade` counts prior attempts inside the processor, so the last one is `+ 1 >= attempts`. */
export function decideEmailFailure(
  err: unknown,
  attemptsMade: number,
  attempts: number
): EmailFailureAction {
  if (emailFailureKind(err) !== 'transient') return 'dead-letter'
  return attemptsMade + 1 >= attempts ? 'dead-letter' : 'retry'
}
