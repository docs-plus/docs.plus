import { z } from 'zod'

import { documentIdSchema } from '../../document-content/http/schema'
import {
  DEFAULT_VERSION_PAGE_SIZE,
  MAX_VERSION_NAME_CHARS,
  MAX_VERSION_NUMBER,
  MAX_VERSION_PAGE_SIZE
} from '../types'

export { contentQuerySchema, documentIdParamSchema } from '../../document-content/http/schema'

// Bounded by the column, not by taste: `Documents.version` is int4, and an
// out-of-range value would reach Prisma and surface as a "persistence is
// wedged" 500 instead of the 400 a typo'd version number deserves.
export const versionParamSchema = z.object({
  documentId: documentIdSchema,
  version: z.coerce.number().int().positive().max(MAX_VERSION_NUMBER)
})

/**
 * `since`/`until` bound `createdAt`, not `version` — `from`/`to` would read as
 * version numbers on this route. Both ends are inclusive and independent.
 */
export const listQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_VERSION_PAGE_SIZE)
    .default(DEFAULT_VERSION_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
  since: z.coerce.date().optional(),
  until: z.coerce.date().optional()
})

/** Omitted means "the version before this one". Whether `base` is older than the
 *  version it is compared against is checked in the handler: the two halves are
 *  validated separately, so no schema can see both. */
export const diffQuerySchema = z.object({
  base: z.coerce.number().int().positive().max(MAX_VERSION_NUMBER).optional()
})

/** The trimmed value becomes the row's `commitMessage`, which retention never prunes. */
export const checkpointBodySchema = z.object({
  name: z.string().trim().min(1).max(MAX_VERSION_NAME_CHARS)
})
