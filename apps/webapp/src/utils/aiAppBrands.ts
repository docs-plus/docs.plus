import type { IconType } from 'react-icons'
import { RiOpenaiFill } from 'react-icons/ri'
import { SiClaude, SiClaudecode, SiCursor } from 'react-icons/si'
import { VscVscode } from 'react-icons/vsc'

export type AiAppId = 'claude' | 'chatgpt' | 'claudeCode' | 'codex' | 'cursor' | 'vscode'

// Brand color on the glyph only; `null` follows the text color, so a black mark stays visible in dark.
export const AI_APP_BRANDS: Record<AiAppId, { component: IconType; color: string | null }> = {
  claude: { component: SiClaude, color: '#d97757' },
  chatgpt: { component: RiOpenaiFill, color: null },
  claudeCode: { component: SiClaudecode, color: '#d97757' },
  codex: { component: RiOpenaiFill, color: null },
  cursor: { component: SiCursor, color: null },
  vscode: { component: VscVscode, color: '#007acc' }
}
