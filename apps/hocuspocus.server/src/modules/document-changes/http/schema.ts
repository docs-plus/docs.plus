import { z } from 'zod'

export { documentIdParamSchema } from '../../document-content/http/schema'

/**
 * `since` bounds `createdAt`, never a version number. Equal ends are allowed and
 * take the same-anchor fast path; a reversed pair is a caller error. A strict
 * ISO instant rather than a coerced date, so the published schema has a type.
 */
export const changesQuerySchema = z
  .object({
    since: z.iso.datetime({ offset: true }),
    until: z.iso.datetime({ offset: true }).optional(),
    scope: z.enum(['summary', 'headings']).default('summary')
  })
  .superRefine((value, ctx) => {
    if (value.until !== undefined && new Date(value.since) > new Date(value.until)) {
      ctx.addIssue({
        code: 'custom',
        message: 'since must not be later than until',
        path: ['since']
      })
    }
  })
