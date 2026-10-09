/** One delivery event, mapped from a provider payload. */
export type DeliveryEvent =
  | {
      type: 'bounce' | 'complaint' | 'suppressed' | 'failed'
      /** Every address the event names. Resend sends `to` as a list. */
      emails: string[]
      reason?: string
      jobId?: string
    }
  | { type: 'ignored' }

export type SignatureCheck = 'valid' | 'malformed' | 'expired' | 'mismatch'
