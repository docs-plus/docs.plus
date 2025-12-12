// BullMQ document storage job data
export interface StoreDocumentData {
  documentName: string
  state: string // base64 encoded Y.js state
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
