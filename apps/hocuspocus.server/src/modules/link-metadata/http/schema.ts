import { z } from 'zod'

import { isIconOrigin } from '../domain/icon'
import { isSafeUrl } from '../domain/ssrf'

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

const ICON_ORIGIN_MAX_LENGTH = 300

export const iconQuerySchema = z.object({
  origin: z
    .string()
    .max(ICON_ORIGIN_MAX_LENGTH)
    .refine(isIconOrigin, { message: 'INVALID_URL', abort: true })
    .refine(isSafeUrl, { message: 'BLOCKED_URL' })
})
