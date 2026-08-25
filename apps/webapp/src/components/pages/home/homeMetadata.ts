const SITE_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || 'https://docs.plus').replace(/\/$/, '')

/** Only the landing route emits GA (`getRoutePolicy().analytics`). */

export const HOME_TITLE = 'docs.plus — Get everyone on the same page'

export const HOME_DESCRIPTION =
  'Free, open-source collaborative documents for teams, communities, and classrooms. Create a doc in seconds — no signup required.'

export const HOME_SITE_URL = SITE_ORIGIN

/** Canonical landing URL — trailing slash matches sitemap `loc`. */
export const HOME_CANONICAL_URL = `${SITE_ORIGIN}/`

export const HOME_OG_IMAGE = `${SITE_ORIGIN}/icons/og-card-1280x640.png`

export const HOME_OG_IMAGE_ALT =
  'docs.plus: a shared document with a chat count beside each section'

export const HOME_OG_IMAGE_WIDTH = '1280'

export const HOME_OG_IMAGE_HEIGHT = '640'

/** Paths allowed in `sitemap.xml` (user docs stay `noindex`). */
export const INDEXABLE_PATHS = ['/', '/privacy', '/terms'] as const

export function buildHomeWebSiteJsonLd(): Record<string, string> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'docs.plus',
    url: HOME_CANONICAL_URL,
    description: HOME_DESCRIPTION
  }
}

export function buildSitemapXml(): string {
  const entries = INDEXABLE_PATHS.map((path) => {
    const loc = path === '/' ? HOME_CANONICAL_URL : `${SITE_ORIGIN}${path}`
    const priority = path === '/' ? '1.0' : '0.4'
    return `  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`
}
