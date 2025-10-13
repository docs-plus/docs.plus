export type { RedisClient } from 'bun'

// Redis save confirmation message
export interface SaveConfirmation {
  documentId: string
  version: number
  timestamp: number
}
