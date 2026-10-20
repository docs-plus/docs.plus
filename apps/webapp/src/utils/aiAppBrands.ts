import type { IconType } from 'react-icons'
import { RiOpenaiFill } from 'react-icons/ri'
import {
  SiClaude,
  SiClaudecode,
  SiCline,
  SiCursor,
  SiGithubcopilot,
  SiLmstudio,
  SiReplit
} from 'react-icons/si'
import { VscVscode } from 'react-icons/vsc'

export type AiAppBrand = { name: string; component: IconType; color: string | null }

// The one home of each app's name and mark. Brand color on the glyph only; `null` follows the
// text color, so a black mark stays visible in dark.
export const AI_APP_BRANDS = {
  claude: { name: 'Claude', component: SiClaude, color: '#d97757' },
  chatgpt: { name: 'ChatGPT', component: RiOpenaiFill, color: null },
  claudeCode: { name: 'Claude Code', component: SiClaudecode, color: '#d97757' },
  codex: { name: 'Codex', component: RiOpenaiFill, color: null },
  copilotCli: { name: 'Copilot CLI', component: SiGithubcopilot, color: null },
  cline: { name: 'Cline', component: SiCline, color: null },
  cursor: { name: 'Cursor', component: SiCursor, color: null },
  vscode: { name: 'VS Code', component: VscVscode, color: '#007acc' },
  lmStudio: { name: 'LM Studio', component: SiLmstudio, color: null },
  replit: { name: 'Replit', component: SiReplit, color: null }
} as const satisfies Record<string, AiAppBrand>

export type AiAppId = keyof typeof AI_APP_BRANDS
