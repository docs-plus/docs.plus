// Slugs that resolve to a concrete page route (which Next.js matches before the
// [...slugs] document catch-all) or to a Next.js system path. These slugs can never
// be document names. Guarded at both the homepage navigate and the document GSSP.
// The MCP create_document mirror is ROUTE_SLUGS in apps/hocuspocus.server/src/modules/mcp/infra/documentStore.ts.
const RESERVED_SLUGS = new Set([
  'editor',
  'new',
  'receive',
  'auth',
  'privacy',
  'terms',
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
