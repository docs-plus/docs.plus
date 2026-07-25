import { z } from 'zod'

/**
 * Deliberately not document-content's `contentQuerySchema`: that `format` is
 * echoed back inside a JSON envelope and pinned in the OpenAPI components,
 * while this one only picks a binary encoder.
 */
export const exportQuerySchema = z.object({
  format: z.enum(['docx', 'md', 'odt']).default('docx')
})
