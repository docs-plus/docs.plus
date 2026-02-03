import { z } from 'zod'

// =============================================================================
// Admin Document Schemas
// =============================================================================

export const listDocumentsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  sortBy: z
    .enum(['title', 'updatedAt', 'createdAt', 'versionCount'])
    .optional()
    .default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().max(200).optional()
})

export const updateDocumentSchema = z.object({
  isPrivate: z.boolean().optional(),
  readOnly: z.boolean().optional()
})

export const deleteDocumentSchema = z.object({
  confirmSlug: z.string().min(1, 'Confirmation slug is required')
})

// =============================================================================
// Analytics Query Schemas
// =============================================================================

export const paginationQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).optional().default('10'),
  days: z.string().regex(/^\d+$/).optional().default('7')
})

export const trendQuerySchema = z.object({
  slug: z.string().optional(),
  days: z.string().regex(/^\d+$/).optional().default('30')
})

export const daysQuerySchema = z.object({
  days: z.string().regex(/^\d+$/).optional().default('7')
})

// =============================================================================
// Export Types
// =============================================================================

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
export type DeleteDocumentInput = z.infer<typeof deleteDocumentSchema>
