// Claude Code PreToolUse hook: the design system is maintainer-owned, so any edit to its rule files
// needs a human "yes". A gitignored .claude/design-system.unlock.json ({ sessions, expires }) lets a
// maintainer-approved session work unprompted until it expires. Fails open on bad input, never blocks.
import { existsSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const PROTECTED = [
  '.cursor/docs/design-system.md',
  '.cursor/rules/design-system.mdc',
  '.cursor/skills/design-system/',
  '.claude/skills/design-system/',
  'apps/webapp/src/styles/globals.scss',
  'apps/admin-dashboard/src/styles/globals.scss',
  '.claude/settings.json',
  '.github/CODEOWNERS',
  'scripts/hooks/design-system-lock.ts'
]
const WRITE_IN_SHELL =
  /(\bsed\b[^|]*\s-i|\bperl\b[^|]*\s-p?i|>|\btee\b|\bmv\b|\bcp\b|\brm\b|\btruncate\b|\bpython3?\b|\bbun\b|\bnode\b|\bprettier\b[^|]*--write|\bgit\b\s+(checkout|restore|reset|stash|apply))/

type HookInput = {
  session_id?: string
  transcript_path?: string
  tool_name?: string
  tool_input?: { file_path?: string; notebook_path?: string; command?: string }
}

const hit = (path: string) => {
  const rel = relative(ROOT, resolve(ROOT, path))
  return PROTECTED.find((p) => rel === p || (p.endsWith('/') && rel.startsWith(p)))
}

const unlocked = (input: HookInput) => {
  const file = join(ROOT, '.claude/design-system.unlock.json')
  if (!existsSync(file)) return false
  try {
    const { sessions = [], expires = 0 } = JSON.parse(readFileSync(file, 'utf8'))
    if (Date.now() > Number(expires)) return false
    return sessions.some(
      (id: string) => id && (input.session_id === id || input.transcript_path?.includes(id))
    )
  } catch {
    return false
  }
}

const input: HookInput = await Bun.stdin.json().catch(() => ({}))
const tool = input.tool_name ?? ''
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path
let matched: string | undefined
if (target) matched = hit(target)
else if (tool === 'Bash' && input.tool_input?.command) {
  const cmd = input.tool_input.command
  matched = PROTECTED.find((p) => cmd.includes(p.replace(/\/$/, '')))
  if (matched && !WRITE_IN_SHELL.test(cmd)) matched = undefined
}

if (matched && !unlocked(input)) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `Design system lock: "${matched}" is maintainer-owned (house language, tokens and rules). Change it only when the maintainer asked for this exact change in this session. See .cursor/docs/design-system.md §Change protocol.`
      }
    })
  )
}
