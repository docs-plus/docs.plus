// Slugs that resolve to a concrete page route (which Next.js matches before the
// [...slugs] document catch-all) or to a Next.js system path — they can never be
// document names. Guarded at both the homepage navigate and the document GSSP.
const RESERVED_SLUGS = new Set([
  'editor',
  'new',
  'auth',
  'unsubscribe',
  '404',
  '500',
  'api',
  '_next',
  '.well-known'
])

export const isReservedSlug = (slug: string | undefined | null): boolean => {
  if (!slug) return false
  return RESERVED_SLUGS.has(slug) || slug.startsWith('_') || slug.startsWith('.well-known')
}
