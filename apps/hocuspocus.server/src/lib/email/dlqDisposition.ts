// Pure, so a test reaches it without the Redis socket queue.ts opens at import.
import type { EmailErrorKind } from './providers/types'

/** `unresolved` is the one state the drain leaves in the queue. */
export type EmailDlqDisposition = 'replay' | 'discard' | 'unresolved'

export interface EmailDlqFacts {
  /** Absent on an entry written before failures were typed. */
  failureKind?: EmailErrorKind
  failedAt?: string
}

// Resend keeps a key for 24 h from its first use, and `failedAt` is the last
// attempt. The retry ladder takes about 15 min, so 30 min is the safe margin.
const EMAIL_REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000 - 30 * 60 * 1000

export function judgeEmailDlqEntry(facts: EmailDlqFacts, now: number): EmailDlqDisposition {
  switch (facts.failureKind) {
    case 'operator':
      return 'replay'
    case 'permanent':
      return 'discard'
    case 'transient': {
      // Past the key's life, Resend may have accepted the timed-out send, and a
      // replay would mail twice. An unreadable time cannot prove it is fresh.
      const failed = facts.failedAt ? Date.parse(facts.failedAt) : Number.NaN
      return now - failed < EMAIL_REPLAY_WINDOW_MS ? 'replay' : 'unresolved'
    }
    default:
      return 'unresolved'
  }
}
