import type { ConnectRow } from '../types'

const SERVER_NAME = 'docs-plus'

/** Links and commands carry only the URL. */
export function connectRows(serverUrl: string): ConnectRow[] {
  const copyUrl = { kind: 'copy', label: 'Copy URL', text: serverUrl } as const
  const cursorConfig = encodeURIComponent(btoa(JSON.stringify({ url: serverUrl })))
  const vscodeConfig = encodeURIComponent(
    JSON.stringify({ name: SERVER_NAME, type: 'http', url: serverUrl })
  )
  const claudeCode = `claude mcp add --transport http ${SERVER_NAME} ${serverUrl}`
  const codex = `codex mcp add ${SERVER_NAME} --url ${serverUrl}`

  return [
    {
      name: 'Claude',
      mark: 'C',
      where: 'claude.ai, Desktop, mobile',
      note: 'Customize › Connectors › Add custom connector. Paste the URL, then choose Connect.',
      link: { text: 'Customize › Connectors', href: 'https://claude.ai/customize/connectors' },
      action: copyUrl,
      // The Claude phone app cannot add a connector; one added on the web works there too.
      phone: {
        where: 'claude.ai, Desktop',
        note: 'On claude.ai or Claude Desktop: Customize › Connectors › Add custom connector. Paste the URL, then choose Connect.'
      }
    },
    {
      name: 'ChatGPT',
      mark: 'G',
      where: 'Plus or higher, on the web',
      note: 'Settings › Security and login: turn on Developer mode. Then open chatgpt.com/plugins, choose +, and paste the URL.',
      link: { text: 'chatgpt.com/plugins', href: 'https://chatgpt.com/plugins' },
      action: copyUrl
    },
    {
      name: 'Cursor, VS Code, Claude Code, Codex',
      mark: '>_',
      note: 'Open Settings on your computer for one-click links and commands.',
      phoneOnly: true
    },
    {
      name: 'Cursor',
      mark: 'Cu',
      note: 'Opens Cursor with docs.plus filled in.',
      action: {
        kind: 'link',
        label: 'Add to Cursor',
        href: `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_NAME}&config=${cursorConfig}`
      },
      desktopOnly: true
    },
    {
      name: 'VS Code',
      mark: 'VS',
      where: 'GitHub Copilot',
      note: 'Opens VS Code with docs.plus filled in.',
      action: { kind: 'link', label: 'Add to VS Code', href: `vscode:mcp/install?${vscodeConfig}` },
      desktopOnly: true
    },
    {
      name: 'Claude Code',
      mark: '>_',
      where: 'terminal',
      note: 'Run this, then run /mcp in Claude Code to sign in.',
      command: claudeCode,
      action: { kind: 'copy', label: 'Copy', text: claudeCode },
      desktopOnly: true
    },
    {
      name: 'Codex',
      mark: '>_',
      where: 'terminal',
      note: `Run this, then run codex mcp login ${SERVER_NAME} to sign in.`,
      command: codex,
      action: { kind: 'copy', label: 'Copy', text: codex },
      desktopOnly: true
    },
    {
      name: 'Other AI apps',
      mark: '+',
      where: 'Kimi Code, Mistral Work and more',
      note: 'Paste the server URL where the app asks for a remote MCP server.',
      action: copyUrl
    }
  ]
}

// RowNote splits the note on the link text, so a missing text would drop the link.
if (process.env.NODE_ENV !== 'production') {
  for (const row of connectRows('https://example.invalid/api/mcp')) {
    for (const note of [row.note, row.phone?.note]) {
      if (row.link && note && !note.includes(row.link.text)) {
        throw new Error(`connectRows: "${row.name}" note lacks its link text`)
      }
    }
  }
}
