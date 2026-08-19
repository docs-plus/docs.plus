export type VisualViewportSyncMode = 'off' | 'landing' | 'document'

export interface RoutePolicy {
  documentShell: boolean
  analytics: boolean
  viewportMode: VisualViewportSyncMode
}

const DOCUMENT_SHELL_PATHS = new Set(['/[...slugs]', '/editor', '/c/[channelId]'])
const UTILITY_PATHS = new Set(['/privacy', '/terms', '/unsubscribe'])

function isDocumentShellPath(pathname: string): boolean {
  return DOCUMENT_SHELL_PATHS.has(pathname)
}

/** True when a client path should prefetch document styles. Utility pages render their own shell. */
export function isDocumentAsPath(asPath: string): boolean {
  const path = asPath.split(/[?#]/)[0] || '/'
  if (path === '/' || path === '') return false
  return !UTILITY_PATHS.has(path) && !path.startsWith('/auth/')
}

/** Central route policy — only the document shell pays for collab styles and viewport sync. */
export function getRoutePolicy(pathname: string): RoutePolicy {
  const documentShell = isDocumentShellPath(pathname)
  const isHome = pathname === '/'

  return {
    documentShell,
    analytics: documentShell || isHome,
    viewportMode: documentShell ? 'document' : isHome ? 'landing' : 'off'
  }
}
