import { Icons } from '@components/icons/registry'
import { HOME_SITE_URL } from '@components/pages/home/homeMetadata'
import { type LinkIconContext, linkIconFetcher, linkIconMap } from '@docs.plus/extension-hyperlink'
import { iconRouteUrl } from '@utils/iconRouteUrl'
import { lucideSvgString } from '@utils/lucideSvgString'

const LOGO = '/icons/logo.svg' // same origin: CSP img-src 'self', Workbox same-origin rule

// linkIconMap throws on a key with ':' (an IPv6 host); a bad URL here would break every pad.
const siteHost = (() => {
  try {
    const host = new URL(HOME_SITE_URL).hostname
    return host.includes(':') ? null : host
  } catch {
    return null
  }
})()
const docsplusMap = linkIconMap(
  siteHost ? { 'docs.plus': LOGO, [siteHost]: LOGO } : { 'docs.plus': LOGO }
)

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

/** Pad resolver: docs.plus logo, then mail and phone glyphs, then the favicon. */
export const padLinkIcon = (ctx: LinkIconContext): HTMLElement | null =>
  docsplusMap(ctx) ?? appScheme(ctx) ?? fetchIcon(ctx)
