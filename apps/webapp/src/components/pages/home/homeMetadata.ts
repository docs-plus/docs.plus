import { MCP_GUIDE_URL, mcpServerUrl } from '@utils/mcpServerUrl'

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
export const INDEXABLE_PATHS = ['/', '/privacy', '/terms', '/mcp'] as const

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

export function buildLlmsTxt(restMcpUrl: string = mcpServerUrl()): string {
  const hasAbsoluteMcp = /^https?:\/\//i.test(restMcpUrl)
  const mcpLines = [
    `- [Connect AI app](${HOME_SITE_URL}/mcp): Setup instructions for Claude, ChatGPT, Claude Code, Codex, Cursor, and other MCP clients.`,
    ...(hasAbsoluteMcp
      ? [
          `- MCP server URL: ${restMcpUrl} (Streamable HTTP, OAuth 2.1 with dynamic client registration)`
        ]
      : []),
    `- [MCP setup guide](${MCP_GUIDE_URL}): Detailed host setup and troubleshooting.`
  ]

  return [
    '# docs.plus',
    '',
    `> ${HOME_DESCRIPTION}`,
    '',
    '## Connect via MCP',
    ...mcpLines,
    '',
    '## Create & Read Documents',
    `- [New blank document](${HOME_SITE_URL}/new): Opens a fresh collaborative document in the browser with no signup required.`,
    `- Markdown negotiation: Send \`Accept: text/markdown\` to \`${HOME_SITE_URL}/<slug>\` to fetch any readable public or Open document as raw Markdown (returns 404 for Private or missing documents, 413 above 1 MiB).`,
    '',
    '## Site & Policies',
    `- [Home](${HOME_SITE_URL}/)`,
    `- [Privacy Policy](${HOME_SITE_URL}/privacy)`,
    `- [Terms of Service](${HOME_SITE_URL}/terms)`,
    ''
  ].join('\n')
}
