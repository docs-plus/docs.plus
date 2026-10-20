import type { AiAppId } from '@utils/aiAppBrands'

import { MCP_SERVER_NAME } from './mcpServerUrl'

export type AgentCommand = { app: AiAppId; name: string; command: string; hint: string }

/** One copyable line per terminal agent. Codex chains its sign-in, because it has no `/mcp`. */
export const agentCommands = (serverUrl: string): AgentCommand[] => [
  {
    app: 'claudeCode',
    name: 'Claude Code',
    command: `claude mcp add --transport http ${MCP_SERVER_NAME} ${serverUrl}`,
    hint: 'claude mcp add …'
  },
  {
    app: 'codex',
    name: 'Codex',
    command: `codex mcp add ${MCP_SERVER_NAME} --url ${serverUrl} && codex mcp login ${MCP_SERVER_NAME}`,
    hint: 'codex mcp add …'
  },
  {
    app: 'copilotCli',
    name: 'Copilot CLI',
    command: `copilot mcp add --transport http ${MCP_SERVER_NAME} ${serverUrl}`,
    hint: 'copilot mcp add …'
  },
  {
    app: 'cline',
    name: 'Cline',
    command: `cline mcp add ${MCP_SERVER_NAME} ${serverUrl} --transport http --yes`,
    hint: 'cline mcp add …'
  }
]

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
    ...agentCommands(serverUrl).map(({ name, command }) => `- ${name}: ${command}`),
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
