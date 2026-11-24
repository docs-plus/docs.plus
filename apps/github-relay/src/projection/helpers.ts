import { cleanText, sanitizeChip, truncateTitle } from '../security.ts'
import type { GitHubUser } from '../types.ts'

const TEAM_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
const PRIORITY_LABELS = new Set(['good first issue', 'help wanted'])
const CRITICAL_LABELS = new Set(['security', 'critical', 'urgent'])
const LINKED_ISSUE_RE = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi

export function isBotUser(user: GitHubUser | undefined | null): boolean {
  if (!user) return false
  if (user.type === 'Bot') return true
  return user.login.endsWith('[bot]')
}

export function isOutsider(authorAssociation: string | undefined | null): boolean {
  if (!authorAssociation) return true
  return !TEAM_ASSOCIATIONS.has(authorAssociation)
}

export function hasClaimLabel(labels: string[]): boolean {
  return labels.some((l) => PRIORITY_LABELS.has(l.toLowerCase()))
}

export function hasCriticalLabel(labels: string[]): boolean {
  return labels.some((l) => CRITICAL_LABELS.has(l.toLowerCase()))
}

export function formatLabelChips(labels: string[], maxVisible = 3): string {
  const cleaned = labels.map(sanitizeChip).filter(Boolean)
  if (cleaned.length === 0) return ''

  const claim = cleaned.filter((l) => PRIORITY_LABELS.has(l.toLowerCase()))
  const rest = cleaned.filter((l) => !PRIORITY_LABELS.has(l.toLowerCase()))
  const sorted = [...claim, ...rest]

  const shown = sorted.slice(0, maxVisible).map((l) => `\`${l}\``)
  const extra = sorted.length > maxVisible ? ` +${sorted.length - maxVisible}` : ''
  return `${shown.join(' ')}${extra}`
}

export function formatDiffStat(additions: number, deletions: number, changedFiles: number): string {
  if (changedFiles <= 0) return ''
  const noun = changedFiles === 1 ? '1 file' : `${changedFiles} files`
  return `\`+${additions} -${deletions}\` in ${noun}`
}

export function extractLinkedIssues(text: string | undefined | null): number[] {
  if (!text) return []
  const found = new Set<number>()
  let match: RegExpExecArray | null
  LINKED_ISSUE_RE.lastIndex = 0
  while ((match = LINKED_ISSUE_RE.exec(text)) !== null) {
    const num = Number.parseInt(match[1], 10)
    if (Number.isFinite(num) && num > 0) found.add(num)
  }
  return [...found]
}

export function resolveUserMentions(
  logins: string[],
  discordUsers: Record<string, string>
): { mentionText: string; mentionIds: string[] } {
  const uniqueLogins = Array.from(new Set(logins.filter(Boolean)))
  const mentionIds: string[] = []
  const parts: string[] = []

  for (const login of uniqueLogins) {
    const discordId = discordUsers[login]
    if (discordId) {
      mentionIds.push(discordId)
      parts.push(`<@${discordId}>`)
    } else {
      parts.push(`\`@${cleanText(login)}\``)
    }
  }

  return {
    mentionText: parts.join(', '),
    mentionIds
  }
}

export function appendTimeline(timeline: string[], step: string): string[] {
  const cleanStep = cleanText(step)
  if (!cleanStep) return timeline
  if (timeline[timeline.length - 1] === cleanStep) return timeline
  return [...timeline.slice(-11), cleanStep]
}

export function formatSoFar(timeline: string[]): string {
  const recent = timeline.slice(-6)
  if (recent.length === 0) return ''
  return truncateTitle(recent.join(' → '), 260)
}
