import { z } from 'zod'

// =============================================================================
// Hypermultimedia (Media Upload) Schemas
// =============================================================================

// Strict charset blocks path-separator / traversal sequences before the id
// ever reaches the filesystem (defense-in-depth with the storage-root check).
const documentIdField = z
  .string()
  .min(1, 'Document ID is required')
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid document ID')

export const documentIdParamSchema = z.object({
  documentId: documentIdField
})

export const mediaIdParamSchema = z.object({
  documentId: documentIdField,
  mediaId: z
    .string()
    .min(1, 'Media ID is required')
    .max(200)
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*\.[A-Za-z0-9]+$/, 'Invalid media ID')
})

// =============================================================================
// Export Types
// =============================================================================

export type DocumentIdParam = z.infer<typeof documentIdParamSchema>
export type MediaIdParam = z.infer<typeof mediaIdParamSchema>
