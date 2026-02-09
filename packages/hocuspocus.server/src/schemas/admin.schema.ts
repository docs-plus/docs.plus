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

export const batchTrendsQuerySchema = z.object({
  slugs: z.string().min(1, 'At least one slug required'),
  days: z.string().regex(/^\d+$/).optional().default('7')
})

// =============================================================================
// Stale Documents Audit Schemas (Phase 13)
// =============================================================================

export const staleDocumentsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
  minScore: z.string().regex(/^\d+$/).optional().default('0'),
  maxVersions: z.string().regex(/^\d+$/).optional(),
  maxContentSize: z.string().regex(/^\d+$/).optional(),
  minAgeDays: z.string().regex(/^\d+$/).optional().default('7'),
  sortBy: z
    .enum(['stale_score', 'version_count', 'content_chars', 'age_days', 'days_inactive'])
    .optional()
    .default('stale_score'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc')
})

export const bulkDeleteSchema = z.object({
  slugs: z.array(z.string()).min(1).max(100),
  dryRun: z.boolean().optional().default(false)
})

// =============================================================================
// Export Types
// =============================================================================

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
export type DeleteDocumentInput = z.infer<typeof deleteDocumentSchema>
export type StaleDocumentsQuery = z.infer<typeof staleDocumentsQuerySchema>
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>
