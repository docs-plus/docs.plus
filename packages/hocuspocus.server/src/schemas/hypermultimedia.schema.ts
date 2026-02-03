import { z } from 'zod'

// =============================================================================
// Hypermultimedia (Media Upload) Schemas
// =============================================================================

export const documentIdParamSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required').max(100)
})

export const mediaIdParamSchema = z.object({
  documentId: z.string().min(1, 'Document ID is required').max(100),
  mediaId: z.string().min(1, 'Media ID is required').max(200)
})

// =============================================================================
// Export Types
// =============================================================================

export type DocumentIdParam = z.infer<typeof documentIdParamSchema>
export type MediaIdParam = z.infer<typeof mediaIdParamSchema>
