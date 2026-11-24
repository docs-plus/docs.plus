import { HOME_CANONICAL_URL, HOME_DESCRIPTION } from '@components/pages/home/homeMetadata'
import { MCP_GUIDE_URL, mcpServerUrl } from '@utils/mcpServerUrl'
import type { GetServerSideProps } from 'next'

export function buildLlmsTxt(origin: string, restMcpUrl: string): string {
  const baseOrigin = origin.replace(/\/$/, '')
  const hasAbsoluteMcp = /^https?:\/\//i.test(restMcpUrl)
  const mcpLines = [
    `- [Connect AI app](${baseOrigin}/mcp): Setup instructions for Claude, ChatGPT, Claude Code, Codex, Cursor, and other MCP clients.`,
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
    `- [New blank document](${baseOrigin}/new): Opens a fresh collaborative document in the browser with no signup required.`,
    `- Markdown negotiation: Send \`Accept: text/markdown\` to \`${baseOrigin}/<slug>\` to fetch any readable public or Open document as raw Markdown (returns 404 for Private or missing documents, 413 above 1 MiB).`,
    '',
    '## Site & Policies',
    `- [Home](${baseOrigin}/)`,
    `- [Privacy Policy](${baseOrigin}/privacy)`,
    `- [Terms of Service](${baseOrigin}/terms)`,
    ''
  ].join('\n')
}

export default function LlmsTxt() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ req, res }) => {
  const origin = HOME_CANONICAL_URL.replace(/\/$/, '')
  const body = buildLlmsTxt(origin, mcpServerUrl())

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  if (req?.method !== 'HEAD') res.write(body)
  res.end()
  return { props: {} }
}
