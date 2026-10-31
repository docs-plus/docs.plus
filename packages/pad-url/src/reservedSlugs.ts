// Slugs that resolve to a concrete page route (which Next.js matches before the
// [...slugs] document catch-all) or to a Next.js system path. These slugs can never
// be document names: the webapp refuses them, and MCP create_document renames them.
const RESERVED_SLUGS = new Set([
  'editor',
  'new',
  'receive',
  'auth',
  'privacy',
  'terms',
  'mcp',
  'oauth',
  'c',
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
