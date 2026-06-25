import slugify from 'slugify'

import { isReservedSlug } from './reservedSlugs'

const MIN_SLUG_LENGTH = 3
const MAX_SLUG_LENGTH = 30

export function randomDocumentSlug(): string {
  return (Math.random() + 1).toString(36).substring(2)
}

export function sanitizeDocumentSlug(input?: string): string {
  const trimmed = input?.trim()
  if (!trimmed) {
    return randomDocumentSlug()
  }

  let sanitized = slugify(trimmed, { lower: true, strict: true })

  if (sanitized.length < MIN_SLUG_LENGTH) {
    sanitized = sanitized.padEnd(MIN_SLUG_LENGTH, 'x')
  } else if (sanitized.length > MAX_SLUG_LENGTH) {
    sanitized = sanitized.substring(0, MAX_SLUG_LENGTH)
  }

  if (isReservedSlug(sanitized)) {
    return randomDocumentSlug()
  }

  return sanitized
}
