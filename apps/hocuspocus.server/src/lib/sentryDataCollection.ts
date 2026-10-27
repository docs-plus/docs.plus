import type { Breadcrumb } from '@sentry/bun'

// Sentry 11 sends cookies and request bodies when dataCollection is omitted.
// This object keeps the v10 baseline.
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] }
  },
  httpBodies: [] as (
    'incomingRequest' | 'outgoingRequest' | 'incomingResponse' | 'outgoingResponse'
  )[],
  urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user', 'url'] },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false }
}

/**
 * Outgoing-request breadcrumbs keep the origin only. The link-metadata scrape fetches pages that
 * readers linked, and a path or query can carry a secret; the privacy page promises the host only.
 */
export const originOnlyBreadcrumb = (breadcrumb: Breadcrumb): Breadcrumb => {
  const url = breadcrumb.data?.url
  if (
    (breadcrumb.category === 'fetch' || breadcrumb.category === 'http') &&
    typeof url === 'string'
  ) {
    try {
      breadcrumb.data = { ...breadcrumb.data, url: new URL(url).origin }
    } catch {
      breadcrumb.data = { ...breadcrumb.data, url: undefined }
    }
  }
  return breadcrumb
}
