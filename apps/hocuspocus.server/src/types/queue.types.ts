// BullMQ document storage job data
export interface StoreDocumentData {
  documentName: string
  /** Redis claim-check key holding the raw Y.js state (preferred shape). */
  stateKey?: string
  /** Inline base64 Y.js state — legacy in-flight jobs and the DLQ payload embed. */
  state?: string
  context: {
    slug?: string
    user?: {
      sub?: string
      email?: string
      // Supabase user_metadata fields
      user_metadata?: {
        full_name?: string
        name?: string
        avatar_url?: string
      }
    }
  }
  commitMessage?: string
}

// Dead letter queue data (for failed jobs)
export interface DeadLetterJobData extends StoreDocumentData {
  originalJobId?: string
  failureReason?: string
  failedAt?: string
}
