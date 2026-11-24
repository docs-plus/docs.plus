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
  'llms.txt',
  'oauth',
  'c',
  'unsubscribe',
  '404',
  '500',
  'api'
])

export const isReservedSlug = (slug: string | undefined | null): boolean => {
  if (!slug) return false
  const normalized = slug.toLowerCase()
  return (
    RESERVED_SLUGS.has(normalized) ||
    normalized.startsWith('_') ||
    normalized.startsWith('.well-known')
  )
}
