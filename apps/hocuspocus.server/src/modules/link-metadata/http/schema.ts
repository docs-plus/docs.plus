import { z } from 'zod'

/**
 * Additive v1 contract. Scheme guard at the HTTP edge so INVALID_URL stays
 * honest; SSRF would catch non-http(s) anyway, but validation skips a
 * pipeline run.
 */
export const metadataQuerySchema = z.object({
  url: z
    .string()
    .url('Invalid URL')
    .max(2048, 'URL too long')
    .refine((value) => /^https?:\/\//i.test(value), 'URL must use http(s) scheme')
})

export type MetadataQuery = z.infer<typeof metadataQuerySchema>
