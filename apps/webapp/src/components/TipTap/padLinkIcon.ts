import { Icons } from '@components/icons/registry'
import { type LinkIconContext, linkIconFetcher, linkIconMap } from '@docs.plus/extension-hyperlink'
import { iconRouteUrl } from '@utils/iconRouteUrl'
import { lucideSvgString } from '@utils/lucideSvgString'

import {
  INTERNAL_KIND_ICON,
  INTERNAL_KIND_NAME,
  linkDestination
} from './hyperlinkPopovers/internalDocumentLink'
import type { InternalDocumentLink, LinkDestination } from './hyperlinkPopovers/types'

// linkDestination already checked the origin, so any host works here. A fixed key keeps
// linkIconMap's one-request-per-URL image cache (#516), on any origin the app runs on.
const logoMap = linkIconMap({ 'docs.plus': '/icons/logo.svg' }) // same origin: CSP img-src 'self'
const LOGO_HREF = 'https://docs.plus/'

const glyph = (svg: () => string) => () =>
  Object.assign(document.createElement('span'), { innerHTML: svg() })
const MAIL = glyph(() => lucideSvgString(Icons.mail, 16))
const TEL = glyph(() => lucideSvgString(Icons.phone, 16))
const appScheme = ({ href }: LinkIconContext) =>
  /^mailto:/i.test(href) ? MAIL() : /^tel:/i.test(href) ? TEL() : null

const routes = new Map<string, string>() // one route string per origin, not per link
const fetchIcon = linkIconFetcher({
  src: (origin) => routes.get(origin) ?? routes.set(origin, iconRouteUrl(origin)).get(origin)!
})

// Each link resolves once per page. A new pathname changes which pad is "this" pad.
const destinations = new Map<string, LinkDestination>()
let destinationsPath = ''
const destinationOf = (href: string): LinkDestination => {
  const path = window.location.pathname
  if (path !== destinationsPath) {
    destinations.clear()
    destinationsPath = path
  }
  if (!destinations.has(href)) destinations.set(href, linkDestination(href, path))
  return destinations.get(href)!
}

const kindIcon = (kind: InternalDocumentLink['kind']): HTMLElement => {
  const el = Object.assign(document.createElement('span'), {
    innerHTML: lucideSvgString(INTERNAL_KIND_ICON[kind], 16)
  })
  el.dataset.linkKind = kind
  el.setAttribute('aria-label', INTERNAL_KIND_NAME[kind])
  return el
}

// Maintainer ruling, 2026-11-09 (#516): from any origin, the docs.plus root and the
// new.docs.plus host are docs.plus too. Literal hosts, so other docs.plus paths keep spec B2.
const isDocsPlusHome = (href: string): boolean => {
  try {
    const { protocol, hostname, pathname } = new URL(href)
    if (protocol !== 'https:' && protocol !== 'http:') return false
    return hostname === 'new.docs.plus' || (hostname === 'docs.plus' && pathname === '/')
  } catch {
    return false
  }
}

/** Pad resolver: same-pad kind glyph, the logo for another or a new pad, mail and phone, then the favicon. */
export const padLinkIcon = (ctx: LinkIconContext): HTMLElement | null => {
  const destination = destinationOf(ctx.href)
  if (destination.kind === 'here') return kindIcon(destination.link.kind)
  if (
    destination.kind === 'pad' ||
    destination.kind === 'newPad' ||
    (destination.kind === 'web' && isDocsPlusHome(ctx.href))
  ) {
    return logoMap({ href: LOGO_HREF })
  }
  return appScheme(ctx) ?? fetchIcon(ctx)
}
