import slugify from 'slugify'

import { isReservedSlug } from './reservedSlugs'

const MIN_SLUG_LENGTH = 3
const MAX_SLUG_LENGTH = 30
const SLUG_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
const RANDOM_SLUG_LENGTH = 11
// 252 is 36 x 7. A byte at or above it would favour the start of the alphabet.
const UNBIASED_BYTE_LIMIT = 252

/** The first signed-in edit owns a new document, so its slug must not be guessable. */
export function randomDocumentSlug(): string {
  let slug = ''
  while (slug.length < RANDOM_SLUG_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < UNBIASED_BYTE_LIMIT && slug.length < RANDOM_SLUG_LENGTH) {
        slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length]
      }
    }
  }
  return slug
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
