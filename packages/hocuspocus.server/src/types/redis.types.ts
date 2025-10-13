// Bun's native Redis client (v1.2.9+)
// Re-export from bun types
export type { RedisClient } from 'bun'

// Redis save confirmation message
export interface SaveConfirmation {
  documentId: string
  version: number
  timestamp: number
}
