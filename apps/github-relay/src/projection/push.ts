import { DISCORD_COLORS } from '../discord/renderer.ts'
import { cleanText, truncateTitle } from '../security.ts'
import type { CardModel, PushBatchItem } from '../types.ts'

interface ParsedCommit {
  sha7: string
  url: string
  prefix: string | null
  subject: string
  author: string
  group: 'Features' | 'Fixes' | 'Performance' | 'Docs' | 'CI & Tooling' | 'Other'
}

const CC_RE = /^([a-zA-Z]+)(?:\(([^)]+)\))?!?:(?:\s+(.*))?$/

function isBuildTriggerCommit(message: string): boolean {
  const firstLine = (message || '').split('\n')[0].trim()
  return firstLine.startsWith('(build)')
}

function classifyGroup(type: string | null): ParsedCommit['group'] {
  if (!type) return 'Other'
  switch (type.toLowerCase()) {
    case 'feat':
      return 'Features'
    case 'fix':
      return 'Fixes'
    case 'perf':
      return 'Performance'
    case 'docs':
      return 'Docs'
    case 'ci':
    case 'build':
    case 'test':
      return 'CI & Tooling'
    default:
      return 'Other'
  }
}

function parseCommit(
  repo: string,
  commit: { id: string; message: string; author: string }
): ParsedCommit {
  const firstLine = cleanText((commit.message || '').split('\n')[0] || '')
  const match = CC_RE.exec(firstLine)
  const sha7 = commit.id.slice(0, 7)
  const url = `https://github.com/${repo}/commit/${commit.id}`

  if (match) {
    const rawType = match[1]
    const scope = match[2] ? `(${match[2]})` : ''
    const bang = firstLine.includes('!:') ? '!' : ''
    const rest = truncateTitle(match[3] || firstLine, 120)
    return {
      sha7,
      url,
      prefix: `${rawType}${scope}${bang}:`,
      subject: rest,
      author: cleanText(commit.author || 'unknown'),
      group: classifyGroup(rawType)
    }
  }

  return {
    sha7,
    url,
    prefix: null,
    subject: truncateTitle(firstLine, 130),
    author: cleanText(commit.author || 'unknown'),
    group: 'Other'
  }
}

function formatCommitLine(c: ParsedCommit, includeAuthor: boolean): string {
  const head = c.prefix ? `**\`${c.prefix}\`** ${c.subject}` : c.subject
  const link = `[\`${c.sha7}\`](${c.url})`
  return includeAuthor ? `${head} · ${link} · ${c.author}` : `${head} · ${link}`
}

export function buildPushCard(batches: PushBatchItem[]): CardModel | null {
  if (batches.length === 0) return null

  const repo = batches[0].repo
  const branch = cleanText(batches[0].ref.replace(/^refs\/heads\//, ''))
  const before = batches[0].before
  const after = batches[batches.length - 1].after
  const compareUrl =
    batches.length === 1 && batches[0].compareUrl
      ? batches[0].compareUrl
      : `https://github.com/${repo}/compare/${before.slice(0, 7)}...${after.slice(0, 7)}`

  const seenShas = new Set<string>()
  const uniqueCommits: Array<{ id: string; message: string; author: string }> = []
  const closedIssues = new Set<number>()
  const pushers = new Set<string>()
  let omittedTriggers = 0

  for (const item of batches) {
    if (item.pusher) pushers.add(cleanText(item.pusher))
    for (const num of item.closedIssues) closedIssues.add(num)
    for (const commit of item.commits) {
      if (seenShas.has(commit.id)) continue
      seenShas.add(commit.id)
      if (isBuildTriggerCommit(commit.message)) {
        omittedTriggers += 1
        continue
      }
      uniqueCommits.push(commit)
    }
  }

  if (uniqueCommits.length === 0) return null

  const triggerNote =
    omittedTriggers > 0
      ? ` · ${omittedTriggers} deploy trigger ${omittedTriggers === 1 ? 'commit' : 'commits'} omitted`
      : ''
  const closedList = [...closedIssues].sort((a, b) => a - b)

  if (uniqueCommits.length === 1) {
    const c = parseCommit(repo, uniqueCommits[0])
    const headline = c.prefix ? `${c.prefix} ${c.subject}` : c.subject
    const closedLine =
      closedList.length > 0
        ? `Closed in this push: ${closedList.map((n) => `[#${n}](https://github.com/${repo}/issues/${n})`).join(', ')}`
        : ''

    return {
      accentColor: DISCORD_COLORS.SLATE,
      stateBadge: `Push · ${branch}`,
      title: truncateTitle(headline, 100),
      primaryButton: { label: 'Commit ↗', url: c.url },
      sections: closedLine ? [closedLine] : [],
      footer: `${repo} · ${c.sha7} by @${c.author}${triggerNote}`,
      silent: true
    }
  }

  const parsed = uniqueCommits.map((c) => parseCommit(repo, c))
  const authors = new Set(parsed.map((c) => c.author))
  const multiAuthor = authors.size > 1
  const groupOrder: ParsedCommit['group'][] = [
    'Features',
    'Fixes',
    'Performance',
    'Docs',
    'CI & Tooling',
    'Other'
  ]

  const sections: string[] = []
  for (const groupName of groupOrder) {
    const items = parsed.filter((c) => c.group === groupName)
    if (items.length === 0) continue

    const cap = items.length > 3 ? 2 : 3
    const lines = items.slice(0, cap).map((c) => `- ${formatCommitLine(c, multiAuthor)}`)
    if (items.length > cap) {
      lines.push(`- _+${items.length - cap} more in ${groupName.toLowerCase()}_`)
    }
    sections.push(`**${groupName} (${items.length})**\n${lines.join('\n')}`)
  }

  if (closedList.length > 0) {
    const links = closedList
      .slice(0, 8)
      .map((n) => `[#${n}](https://github.com/${repo}/issues/${n})`)
      .join(', ')
    const extra = closedList.length > 8 ? ` +${closedList.length - 8}` : ''
    sections.push(`**Closed in this push:** ${links}${extra}`)
  }

  const pusherLabel =
    pushers.size === 1 ? ` by @${[...pushers][0]}` : ` by ${pushers.size} contributors`

  return {
    accentColor: DISCORD_COLORS.SLATE,
    stateBadge: `Push · ${branch}`,
    title: `${uniqueCommits.length} commits to ${branch}${pusherLabel}`,
    primaryButton: { label: 'View Diff ↗', url: compareUrl },
    sections,
    footer: `${repo}${triggerNote}`,
    silent: true
  }
}
