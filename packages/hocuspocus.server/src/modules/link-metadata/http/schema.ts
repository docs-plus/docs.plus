import { z } from 'zod'

/**
 * Request wire contract. Treat as published API: additive changes only
 * within v1; breaking changes mint a new path.
 *
 * The scheme guard rejects non-http(s) URLs at the HTTP edge so the
 * router's `INVALID_URL` error message stays honest. The pipeline's
 * SSRF guard would catch them anyway, but failing fast at validation
 * keeps the wire contract truthful and skips a pipeline allocation.
 */
export const metadataQuerySchema = z.object({
  url: z
    .string()
    .url('Invalid URL')
    .max(2048, 'URL too long')
    .refine((value) => /^https?:\/\//i.test(value), 'URL must use http(s) scheme')
})

export type MetadataQuery = z.infer<typeof metadataQuerySchema>
