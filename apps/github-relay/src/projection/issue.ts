import { DISCORD_COLORS } from '../discord/renderer.ts'
import { cleanText, extractCommentExcerpt, truncateTitle } from '../security.ts'
import type {
  CardModel,
  GitHubIssue,
  GitHubIssueCommentEvent,
  GitHubIssuesEvent,
  IssueBatchItem,
  IssueEntityState,
  RelayConfig
} from '../types.ts'
import {
  appendTimeline,
  formatLabelChips,
  formatSoFar,
  hasClaimLabel,
  hasCriticalLabel,
  isBotUser,
  isOutsider,
  resolveUserMentions
} from './helpers.ts'

const CLAIM_COMMENT_RE =
  /\b(claim|take this|work on|assign me|open a pr|i can reproduce|i'?ll fix|handle this)\b/i

export function stripIssueTemplatePrefix(title: string, labels: string[]): string {
  const lower = labels.map((l) => l.toLowerCase())
  const cleaned = cleanText(title)
  if (lower.includes('bug') && cleaned.toLowerCase().startsWith('[bug]:')) {
    return cleaned.slice(6).trim()
  }
  if (lower.includes('enhancement') && cleaned.toLowerCase().startsWith('[feature]:')) {
    return cleaned.slice(10).trim()
  }
  return cleaned
}

export function isSpecialIssue(labels: string[], outsider: boolean): boolean {
  return hasClaimLabel(labels) || hasCriticalLabel(labels) || outsider
}

export function buildIssueCard(
  state: IssueEntityState,
  repo: string,
  silent: boolean,
  config: RelayConfig
): CardModel {
  const chips = formatLabelChips(state.labels)
  const critical = hasCriticalLabel(state.labels)
  const claimable = hasClaimLabel(state.labels)
  const cleanSubject = stripIssueTemplatePrefix(state.title, state.labels)

  if (state.state === 'closed') {
    let badge = 'Closed'
    let accent: number = DISCORD_COLORS.SLATE
    if (state.linkedPrNumber) {
      badge = `Closed · PR #${state.linkedPrNumber}`
      accent = DISCORD_COLORS.GREEN
    } else if (state.stateReason === 'not_planned') {
      badge = 'Closed · Not Planned'
    } else if (state.stateReason === 'duplicate') {
      badge = 'Closed · Duplicate'
    }
    const soFar = formatSoFar(state.timeline)
    return {
      accentColor: accent,
      stateBadge: badge,
      title: truncateTitle(`📕 #${state.number} ${cleanSubject}`, 100),
      primaryButton: { label: 'View Issue ↗', url: state.url },
      sections: soFar ? [`**Timeline:** ${soFar}`] : [],
      footer: `${repo} · opened by @${state.author}`,
      silent: true
    }
  }

  let accentColor: number = DISCORD_COLORS.SKY
  let stateBadge = 'Issue Opened'
  let glyph = '📥'
  let bannerLine = ''
  let mentionIds: string[] = []

  if (critical) {
    accentColor = DISCORD_COLORS.RED
    stateBadge = state.labels.some((l) => l.toLowerCase() === 'security')
      ? 'Security · Critical'
      : 'Critical · Urgent'
    glyph = '🚨'
    const targets = state.assignees.length > 0 ? state.assignees : Object.keys(config.discordUsers)
    const resolved = resolveUserMentions(targets.slice(0, 3), config.discordUsers)
    mentionIds = resolved.mentionIds
    if (resolved.mentionText) {
      bannerLine = `Owner ping: ${resolved.mentionText}`
    }
  } else if (claimable && state.assignees.length === 0) {
    accentColor = DISCORD_COLORS.AMBER
    stateBadge = 'Up for grabs'
    glyph = '🙋'
    bannerLine = '🟡 **Up for grabs** · nobody has claimed this yet'
  } else if (claimable && state.assignees.length > 0) {
    accentColor = DISCORD_COLORS.SKY
    stateBadge = 'Claimed'
    glyph = '📥'
  }

  const statusText =
    state.assignees.length > 0
      ? `Claimed by ${state.assignees.map((a) => `\`@${cleanText(a)}\``).join(', ')}`
      : claimable
        ? 'Unassigned'
        : 'Open'

  const metaLine = [chips, `**Status:** ${statusText}`].filter(Boolean).join(' · ')
  const sections = [bannerLine, metaLine].filter(Boolean)
  const outsiderTag = state.outsider ? ' (outside contributor)' : ''

  return {
    accentColor,
    stateBadge,
    title: truncateTitle(`${glyph} #${state.number} ${cleanSubject}`, 100),
    primaryButton: { label: 'Open Issue ↗', url: state.url },
    sections,
    footer: `${repo} · opened by @${state.author}${outsiderTag}`,
    silent,
    mentionUserIds: mentionIds
  }
}

export function buildIssueStateFromPayload(
  issue: GitHubIssue,
  existing: IssueEntityState | null,
  step?: string
): IssueEntityState {
  const labels = (issue.labels ?? []).map((l) => l.name)
  const assignees = (issue.assignees ?? []).map((a) => cleanText(a.login))
  const timeline = step
    ? appendTimeline(existing?.timeline ?? ['Opened'], step)
    : (existing?.timeline ?? ['Opened'])

  return {
    kind: 'issue',
    number: issue.number,
    title: cleanText(issue.title),
    url: issue.html_url,
    author: cleanText(issue.user.login),
    outsider: existing?.outsider ?? isOutsider(issue.author_association),
    state: issue.state,
    stateReason: issue.state_reason ?? existing?.stateReason ?? '',
    labels,
    assignees,
    commentCount: existing?.commentCount ?? 0,
    linkedPrNumber: existing?.linkedPrNumber ?? null,
    timeline
  }
}

export function buildTriageBatchCard(items: IssueBatchItem[], repo: string): CardModel | null {
  if (items.length === 0) return null
  const verb = items[0].action === 'closed' ? 'closed' : 'opened'
  const actor = cleanText(items[0].actor)

  const grouped = new Map<string, IssueBatchItem[]>()
  for (const item of items) {
    const primary =
      item.labels.find(
        (l) => !['bug', 'enhancement', 'documentation', 'question'].includes(l.toLowerCase())
      ) ||
      item.labels[0] ||
      'General'
    const bucket = grouped.get(primary) ?? []
    bucket.push(item)
    grouped.set(primary, bucket)
  }

  const lines = [...grouped.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8)
    .map(([group, list]) => {
      const links = list
        .slice(0, 6)
        .map((i) => `[#${i.number}](${i.url})`)
        .join(', ')
      const extra = list.length > 6 ? ` +${list.length - 6}` : ''
      return `- **${cleanText(group)} (${list.length}):** ${links}${extra}`
    })

  return {
    accentColor: items[0].action === 'closed' ? DISCORD_COLORS.SLATE : DISCORD_COLORS.SKY,
    stateBadge: 'Triage Batch',
    title: `${items.length} issues ${verb} by @${actor}`,
    primaryButton: { label: 'View Issues ↗', url: `https://github.com/${repo}/issues` },
    sections: [lines.join('\n')],
    footer: `${repo} · Coalesced in burst window (replaces ${items.length} separate cards)`,
    silent: true
  }
}

export function projectIssueMutationEvent(
  event: GitHubIssuesEvent,
  existing: IssueEntityState | null,
  config: RelayConfig
): {
  entityKey: string
  state: IssueEntityState
  anchorCard: CardModel
  replyCard?: CardModel
  triageCard?: CardModel
} | null {
  const issue = event.issue
  if (isBotUser(issue.user)) return null

  const action = event.action
  const repo = event.repository.full_name
  const labels = (issue.labels ?? []).map((l) => l.name)
  const outsider = isOutsider(issue.author_association)

  let stepLabel = ''
  if (action === 'reopened') stepLabel = 'Reopened'
  else if (action === 'assigned' && event.assignee) {
    stepLabel = `Claimed by @${cleanText(event.assignee.login)}`
  } else if (action === 'unassigned') stepLabel = 'Unassigned'
  else if (action === 'labeled' && event.label) {
    const added = event.label.name.toLowerCase()
    if (added === 'good first issue' || added === 'help wanted') stepLabel = 'Up for grabs'
    else if (hasCriticalLabel([added])) stepLabel = `Labeled ${event.label.name}`
    else if (!existing) return null
    else stepLabel = `Labeled ${event.label.name}`
  } else if (action === 'unlabeled') {
    if (!existing) return null
    stepLabel = 'Labels updated'
  } else {
    return null
  }

  const state = buildIssueStateFromPayload(issue, existing, stepLabel)
  const critical = hasCriticalLabel(labels)
  const claimable = hasClaimLabel(labels) && state.state === 'open' && state.assignees.length === 0
  const isLoud =
    critical ||
    (action === 'labeled' && claimable) ||
    (action === 'reopened' && (claimable || outsider))

  const anchorCard = buildIssueCard(state, repo, !isLoud, config)

  let triageCard: CardModel | undefined
  if (
    config.hasDistinctTriageChannel &&
    critical &&
    (!existing || !hasCriticalLabel(existing.labels))
  ) {
    triageCard = buildIssueCard(state, repo, false, config)
  }

  return {
    entityKey: `issue:${state.number}`,
    state,
    anchorCard,
    triageCard
  }
}

export function projectIssueCommentEvent(
  event: GitHubIssueCommentEvent,
  existing: IssueEntityState | null,
  config: RelayConfig
): {
  entityKey: string
  state: IssueEntityState
  anchorCard: CardModel
  replyCard: CardModel
  triageReplyCard?: CardModel
} | null {
  if (event.action !== 'created') return null
  const c = event.comment
  if (isBotUser(c.user) || isBotUser(event.issue.user)) return null

  const labels = (event.issue.labels ?? []).map((l) => l.name)
  const outsider = isOutsider(c.author_association)
  const claimIntent = hasClaimLabel(labels) && CLAIM_COMMENT_RE.test(c.body ?? '')
  const critical = hasCriticalLabel(labels)

  if (!outsider && !claimIntent && !critical) return null

  const excerpt = extractCommentExcerpt(c.body, 220)
  if (!excerpt) return null

  const repo = event.repository.full_name
  const commenter = cleanText(c.user.login)
  const nextCount = (existing?.commentCount ?? 0) + 1
  const step = claimIntent ? `@${commenter} volunteered to claim` : `${nextCount} comments`
  const state = buildIssueStateFromPayload(event.issue, existing, step)
  state.commentCount = nextCount

  const replyCard: CardModel = {
    accentColor: critical
      ? DISCORD_COLORS.RED
      : outsider
        ? DISCORD_COLORS.AMBER
        : DISCORD_COLORS.SKY,
    stateBadge: claimIntent ? 'Claim Comment' : outsider ? 'Contributor Comment' : 'Issue Comment',
    title: `@${commenter} commented on #${state.number}`,
    primaryButton: { label: 'View Comment ↗', url: c.html_url },
    sections: [`> "${excerpt}"`, `**So far:** ${formatSoFar(state.timeline)}`],
    footer: `${repo} · #${state.number}`,
    silent: false
  }

  let triageReplyCard: CardModel | undefined
  if (config.hasDistinctTriageChannel && (outsider || critical)) {
    const owners =
      state.assignees.length > 0 ? state.assignees : Object.keys(config.discordUsers).slice(0, 2)
    const { mentionText, mentionIds } = resolveUserMentions(owners, config.discordUsers)
    triageReplyCard = {
      ...replyCard,
      sections: [
        `> "${excerpt}"`,
        `**So far:** ${formatSoFar(state.timeline)}`,
        ...(mentionText ? [`**Waiting on:** ${mentionText}`] : [])
      ],
      mentionUserIds: mentionIds
    }
  }

  return {
    entityKey: `issue:${state.number}`,
    state,
    anchorCard: buildIssueCard(state, repo, true, config),
    replyCard,
    triageReplyCard
  }
}
