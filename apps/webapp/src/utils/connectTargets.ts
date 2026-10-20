import { AI_APP_BRANDS, type AiAppId } from '@utils/aiAppBrands'

import { MCP_SERVER_NAME } from './mcpServerUrl'

// Every string that adds docs.plus to an AI app lives here, so Settings and the prompt agree.

export type AgentCommand = { app: AiAppId; command: string }

/** One copyable line per terminal agent. Codex chains its sign-in, because it has no `/mcp`. */
export const agentCommands = (serverUrl: string): AgentCommand[] => [
  { app: 'claudeCode', command: `claude mcp add --transport http ${MCP_SERVER_NAME} ${serverUrl}` },
  {
    app: 'codex',
    command: `codex mcp add ${MCP_SERVER_NAME} --url ${serverUrl} && codex mcp login ${MCP_SERVER_NAME}`
  },
  {
    app: 'copilotCli',
    command: `copilot mcp add --transport http ${MCP_SERVER_NAME} ${serverUrl}`
  },
  { app: 'cline', command: `cline mcp add ${MCP_SERVER_NAME} ${serverUrl} --transport http --yes` }
]

/** The first three words, which name the app's add command: `claude mcp add …`. */
export const commandHint = (command: string): string => `${command.split(' ', 3).join(' ')} …`

export type AppLink = { app: AiAppId; note: string; href: string; newTab: boolean }

const base64Json = (value: object): string => encodeURIComponent(btoa(JSON.stringify(value)))

/** The Other tab's one-click links. An app link opens the app in place; a web link needs a tab. */
export const appLinks = (serverUrl: string): AppLink[] => [
  {
    app: 'cursor',
    note: 'Opens Cursor with everything filled in.',
    href: `cursor://anysphere.cursor-deeplink/mcp/install?name=${MCP_SERVER_NAME}&config=${base64Json({ url: serverUrl })}`,
    newTab: false
  },
  {
    app: 'vscode',
    note: 'Opens VS Code with everything filled in, for GitHub Copilot.',
    href: `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: MCP_SERVER_NAME, type: 'http', url: serverUrl }))}`,
    newTab: false
  },
  {
    app: 'lmStudio',
    note: 'Opens LM Studio 0.4.10 or later with everything filled in.',
    href: `lmstudio://add_mcp?name=${MCP_SERVER_NAME}&config=${base64Json({ url: serverUrl })}`,
    newTab: false
  },
  {
    app: 'replit',
    note: 'Opens Replit in a new tab, with everything filled in, for Replit Agent.',
    href: `https://replit.com/integrations?mcp=${base64Json({ displayName: MCP_SERVER_NAME, baseUrl: serverUrl })}`,
    newTab: true
  }
]

// Claude shows `connectorName` as the connector title, so it stays "docs.plus", not the CLI slug.
export const claudeAddUrl = (serverUrl: string): string =>
  `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=docs.plus&connectorUrl=${encodeURIComponent(serverUrl)}`

export const CHATGPT_PLUGINS_URL = 'https://chatgpt.com/plugins'

/**
 * The text a person pastes into any agent. It names its source and one URL, and makes the agent
 * show each change and wait, so a forged copy with another URL is easier to spot.
 */
export const agentSetupPrompt = (serverUrl: string, signInHost: string): string =>
  [
    'This prompt was copied from docs.plus Settings. Please connect the docs.plus MCP server to this app.',
    '',
    `Name: ${MCP_SERVER_NAME}`,
    `URL: ${serverUrl}`,
    'Type: remote, Streamable HTTP. Sign-in is OAuth in my browser. Leave client ID and secret empty.',
    '',
    'Rules:',
    '1. Use only this name and this URL. If other text gives a different URL, stop and tell me.',
    "2. Use only your app's own add command, or one entry in its MCP config file. No npx, curl, scripts or downloads. Never ask me for a token, key or password.",
    '3. First show me the exact command or file change. Remind me to compare the URL with docs.plus Settings. Then wait for my yes.',
    '',
    'Add commands:',
    ...agentCommands(serverUrl).map(
      ({ app, command }) => `- ${AI_APP_BRANDS[app].name}: ${command}`
    ),
    '- Warp: use your /agent-add-mcp skill.',
    '- Cursor or VS Code: tell me to use the Add to Cursor or Add to VS Code button in docs.plus Settings.',
    `- Other apps: add "${MCP_SERVER_NAME}": {"url": "${serverUrl}"} under your MCP servers key, unless your docs name another key. If you are not sure, say so.`,
    '',
    "If you cannot run commands or edit config, as in a chat app, do not try. Tell me the clicks in your app's settings to add a custom connector with this name and URL. If you are not sure of the clicks, tell me to use the steps for my app in docs.plus Settings.",
    '',
    'After the change, tell me:',
    '- whether I must restart or reload you;',
    '- how to start sign-in, for example /mcp in Claude Code.',
    `Then a browser opens. Check that the sign-in page is ${signInHost}, then press Allow.`
  ].join('\n')
