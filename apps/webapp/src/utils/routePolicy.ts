export type VisualViewportSyncMode = 'off' | 'landing' | 'document'

export interface RoutePolicy {
  documentShell: boolean
  deferAnonymousAuth: boolean
  analytics: boolean
  viewportMode: VisualViewportSyncMode
}

const DOCUMENT_SHELL_PATHS = new Set(['/[...slugs]', '/editor', '/c/[channelId]'])

function isDocumentShellPath(pathname: string): boolean {
  return DOCUMENT_SHELL_PATHS.has(pathname)
}

/** Central route policy — landing defers anon auth + heavy collab; utility routes still anon-sign-in. */
export function getRoutePolicy(pathname: string): RoutePolicy {
  const documentShell = isDocumentShellPath(pathname)
  const isHome = pathname === '/'

  return {
    documentShell,
    deferAnonymousAuth: isHome,
    analytics: documentShell || isHome,
    viewportMode: documentShell ? 'document' : isHome ? 'landing' : 'off'
  }
}
