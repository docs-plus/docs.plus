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
// Failed Notifications Audit Schemas (Phase 17)
// =============================================================================

export const auditFailedSubsQuerySchema = z.object({
  minFailures: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('100')
})

export const auditEmailBouncesQuerySchema = z.object({
  bounceType: z.enum(['hard', 'soft', 'complaint']).optional(),
  days: z.string().regex(/^\d+$/).optional().default('30'),
  limit: z.string().regex(/^\d+$/).optional().default('100')
})

export const disableFailedSubsSchema = z.object({
  minFailures: z.number().int().min(1).default(5),
  errorPattern: z.string().max(200).optional().default('%'),
  subscriptionIds: z.array(z.string().uuid()).max(500).optional()
})

// =============================================================================
// Ghost Accounts Audit Schemas (Phase 15)
// =============================================================================

export const ghostAccountsQuerySchema = z.object({
  minAgeDays: z.string().regex(/^\d+$/).optional().default('7'),
  ghostType: z
    .enum([
      'unconfirmed_magic_link',
      'abandoned_sso',
      'stale_unconfirmed',
      'never_signed_in',
      'no_public_profile',
      'stale_anonymous',
      'orphaned_anonymous'
    ])
    .optional(),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  perPage: z.string().regex(/^\d+$/).optional().default('50')
})

export const ghostDeleteSchema = z.object({
  userId: z.string().uuid()
})

export const ghostBulkDeleteSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50)
})

export const ghostResendSchema = z.object({
  email: z.string().email()
})

export const ghostCleanupAnonymousSchema = z.object({
  minAgeDays: z.number().int().min(30).default(90)
})

// =============================================================================
// Export Types
// =============================================================================

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
export type DeleteDocumentInput = z.infer<typeof deleteDocumentSchema>
export type StaleDocumentsQuery = z.infer<typeof staleDocumentsQuerySchema>
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>
export type AuditFailedSubsQuery = z.infer<typeof auditFailedSubsQuerySchema>
export type AuditEmailBouncesQuery = z.infer<typeof auditEmailBouncesQuerySchema>
export type DisableFailedSubsInput = z.infer<typeof disableFailedSubsSchema>
export type GhostAccountsQuery = z.infer<typeof ghostAccountsQuerySchema>
export type GhostDeleteInput = z.infer<typeof ghostDeleteSchema>
export type GhostBulkDeleteInput = z.infer<typeof ghostBulkDeleteSchema>
export type GhostResendInput = z.infer<typeof ghostResendSchema>
export type GhostCleanupAnonymousInput = z.infer<typeof ghostCleanupAnonymousSchema>
