import { createHash } from 'node:crypto'

// Any change to how a card draws changes this id, so every cached copy gets a new URL.
const TEMPLATE_ID = 'social-card-3'

/** A short hash of the template and every drawn value: the `v` in the card URL, the ETag and the cache key. */
export const cardVersion = (kind: string, values: string[]): string =>
  createHash('sha256')
    .update([TEMPLATE_ID, kind, ...values].join('\u0000'))
    .digest('base64url')
    .slice(0, 12)
