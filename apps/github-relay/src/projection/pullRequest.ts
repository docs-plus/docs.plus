import { DISCORD_COLORS } from '../discord/renderer.ts'
import { cleanText, extractCommentExcerpt, truncateTitle } from '../security.ts'
import type {
  CardButton,
  CardModel,
  GitHubIssueCommentEvent,
  GitHubPullRequest,
  GitHubPullRequestEvent,
  GitHubPullRequestReviewEvent,
  PrEntityState,
  RelayConfig
} from '../types.ts'
import {
  appendTimeline,
  extractLinkedIssues,
  formatDiffStat,
  formatLabelChips,
  formatSoFar,
  isBotUser,
  isOutsider,
  resolveUserMentions
} from './helpers.ts'

function formatReviewersStrip(reviewers: PrEntityState['reviewers']): string {
  const entries = Object.entries(reviewers)
  if (entries.length === 0) return 'None yet'
  return entries
    .slice(0, 4)
    .map(([login, status]) => {
      const icon = status === 'approved' ? '✅' : status === 'changes_requested' ? '🔁' : '⏳'
      return `${icon} \`@${cleanText(login)}\``
    })
    .join(', ')
}

function formatCiBadge(ci: PrEntityState['ciStatus']): string {
  switch (ci) {
    case 'passed':
      return '✅ Checks passed'
    case 'failed':
      return '❌ Checks failed'
    case 'pending':
      return '⏳ Running gates'
    default:
      return '— Pending'
  }
}

export function buildPrCard(state: PrEntityState, repo: string, silent: boolean): CardModel {
  const reviewerStatuses = Object.values(state.reviewers)
  const hasChangesReq = reviewerStatuses.includes('changes_requested')
  const hasApproval = reviewerStatuses.includes('approved')

  let accentColor: number = DISCORD_COLORS.VIOLET
  let stateBadge = 'PR Open'

  if (state.merged) {
    accentColor = DISCORD_COLORS.GREEN
    stateBadge = 'PR Merged'
  } else if (state.closed) {
    accentColor = DISCORD_COLORS.SLATE
    stateBadge = 'Closed · Unmerged'
  } else if (state.draft) {
    accentColor = DISCORD_COLORS.SLATE
    stateBadge = 'PR Draft'
  } else if (state.ciStatus === 'failed') {
    accentColor = DISCORD_COLORS.RED
    stateBadge = 'CI Blocked'
  } else if (hasChangesReq) {
    accentColor = DISCORD_COLORS.AMBER
    stateBadge = 'Changes Requested'
  } else if (hasApproval) {
    accentColor = DISCORD_COLORS.GREEN
    stateBadge = 'PR Approved'
  } else if (state.timeline.includes('Ready for review')) {
    accentColor = DISCORD_COLORS.VIOLET
    stateBadge = 'Ready for Review'
  }

  const diff = formatDiffStat(state.additions, state.deletions, state.changedFiles)
  const chips = formatLabelChips(state.labels)
  const linked =
    state.linkedIssues.length > 0
      ? `Closes ${state.linkedIssues
          .slice(0, 3)
          .map((n) => `[#${n}](https://github.com/${repo}/issues/${n})`)
          .join(', ')}`
      : ''

  const metaParts = [diff, chips, linked].filter(Boolean)
  const sections: string[] = []
  if (metaParts.length > 0) sections.push(metaParts.join(' · '))

  if (!state.closed) {
    sections.push(
      `**Reviewers:** ${formatReviewersStrip(state.reviewers)} · **CI:** ${formatCiBadge(state.ciStatus)} · **Waiting on:** ${state.waitingOn}`
    )
  } else {
    const soFar = formatSoFar(state.timeline)
    if (soFar) sections.push(`**Timeline:** ${soFar}`)
  }

  const buttons: CardButton[] = [{ label: 'View Diff ↗', url: `${state.url}/files` }]
  if (state.linkedIssues.length > 0) {
    const firstIssue = state.linkedIssues[0]
    buttons.push({
      label: `Linked Issue #${firstIssue} ↗`,
      url: `https://github.com/${repo}/issues/${firstIssue}`
    })
  }

  const outsiderTag = state.outsider ? ' (outside contributor)' : ''
  const titleGlyph = state.merged ? '✅' : state.closed ? '📕' : '🔀'

  return {
    accentColor,
    stateBadge,
    title: truncateTitle(`${titleGlyph} #${state.number} ${state.title}`, 100),
    primaryButton: { label: 'Open PR ↗', url: state.url },
    sections,
    buttons,
    footer: `${repo} · opened by @${state.author}${outsiderTag}`,
    silent
  }
}

export function buildTriagePrCard(
  state: PrEntityState,
  repo: string,
  badge: string,
  accentColor: number,
  targetLogins: string[],
  config: RelayConfig
): CardModel {
  const { mentionText, mentionIds } = resolveUserMentions(targetLogins, config.discordUsers)
  const diff = formatDiffStat(state.additions, state.deletions, state.changedFiles)
  const linked =
    state.linkedIssues.length > 0
      ? `Closes ${state.linkedIssues.map((n) => `[#${n}](https://github.com/${repo}/issues/${n})`).join(', ')}`
      : ''
  const line1 = [diff, `CI: **${formatCiBadge(state.ciStatus)}**`, linked]
    .filter(Boolean)
    .join(' · ')
  const waitingLine = `**Waiting on:** ${mentionText || state.waitingOn} · Author: \`@${state.author}\``

  const buttons: CardButton[] = [{ label: 'Files Changed ↗', url: `${state.url}/files` }]
  if (state.linkedIssues.length > 0) {
    const num = state.linkedIssues[0]
    buttons.push({
      label: `Linked Issue #${num} ↗`,
      url: `https://github.com/${repo}/issues/${num}`
    })
  }

  return {
    accentColor,
    stateBadge: badge,
    title: truncateTitle(`🔀 #${state.number} ${state.title}`, 100),
    primaryButton: { label: 'Review PR ↗', url: state.url },
    sections: [line1, waitingLine],
    buttons,
    footer: `${repo} · maintainer queue`,
    silent: false,
    mentionUserIds: mentionIds
  }
}

function buildStateFromPr(
  pr: GitHubPullRequest,
  existing: PrEntityState | null,
  actionStep: string
): PrEntityState {
  const author = cleanText(pr.user.login)
  const outsider = existing?.outsider ?? isOutsider(pr.author_association)
  const labels = (pr.labels ?? []).map((l) => l.name)
  const linkedIssues = Array.from(
    new Set([...(existing?.linkedIssues ?? []), ...extractLinkedIssues(pr.body)])
  )

  const reviewers: PrEntityState['reviewers'] = { ...(existing?.reviewers ?? {}) }
  for (const r of pr.requested_reviewers ?? []) {
    if (!isBotUser(r) && !reviewers[r.login]) {
      reviewers[r.login] = 'pending'
    }
  }

  const timeline = appendTimeline(existing?.timeline ?? ['Opened'], actionStep)
  const pendingReviewers = Object.entries(reviewers)
    .filter(([, s]) => s === 'pending')
    .map(([login]) => `@${cleanText(login)}`)
  const changesReq = Object.values(reviewers).includes('changes_requested')

  let waitingOn = existing?.waitingOn || 'Maintainer review'
  if (pr.merged) waitingOn = 'Merged'
  else if (pr.state === 'closed') waitingOn = 'Closed'
  else if (changesReq) waitingOn = `@${author} (author fix)`
  else if (pendingReviewers.length > 0) waitingOn = pendingReviewers.join(', ')

  return {
    kind: 'pr',
    number: pr.number,
    title: cleanText(pr.title),
    url: pr.html_url,
    author,
    outsider,
    draft: Boolean(pr.draft),
    merged: Boolean(pr.merged),
    closed: pr.state === 'closed',
    additions: pr.additions ?? existing?.additions ?? 0,
    deletions: pr.deletions ?? existing?.deletions ?? 0,
    changedFiles: pr.changed_files ?? existing?.changedFiles ?? 0,
    labels,
    linkedIssues,
    reviewers,
    ciStatus: existing?.ciStatus ?? 'unknown',
    commentCount: existing?.commentCount ?? 0,
    waitingOn,
    timeline
  }
}

export function projectPullRequestEvent(
  event: GitHubPullRequestEvent,
  existing: PrEntityState | null,
  config: RelayConfig
): {
  entityKey: string
  state: PrEntityState
  anchorCard: CardModel
  replyCard?: CardModel
  triageCard?: { entityKey: string; state: PrEntityState; card: CardModel }
  mergedCommitSha?: string
} | null {
  const pr = event.pull_request
  if (isBotUser(pr.user)) return null

  const action = event.action
  const repo = event.repository.full_name
  const actor = cleanText(event.sender?.login || pr.user.login)

  if (action === 'opened' && pr.draft) return null
  if (action === 'closed' && !pr.merged && !existing) return null

  const supported = [
    'opened',
    'ready_for_review',
    'converted_to_draft',
    'review_requested',
    'reopened',
    'synchronize',
    'closed'
  ]
  if (!supported.includes(action)) return null

  let stepLabel = 'Updated'
  if (action === 'opened') stepLabel = 'Opened'
  else if (action === 'ready_for_review') stepLabel = 'Ready for review'
  else if (action === 'converted_to_draft') stepLabel = 'Draft'
  else if (action === 'review_requested') stepLabel = 'Review requested'
  else if (action === 'reopened') stepLabel = 'Reopened'
  else if (action === 'synchronize') stepLabel = 'New commits pushed'
  else if (action === 'closed') stepLabel = pr.merged ? 'Merged' : 'Closed unmerged'

  const state = buildStateFromPr(pr, existing, stepLabel)
  if (action === 'synchronize') {
    state.ciStatus = 'pending'
    for (const [login, status] of Object.entries(state.reviewers)) {
      if (status === 'changes_requested') {
        state.reviewers[login] = 'pending'
      }
    }
    const pending = Object.entries(state.reviewers)
      .filter(([, s]) => s === 'pending')
      .map(([login]) => `@${cleanText(login)}`)
    if (pending.length > 0) state.waitingOn = pending.join(', ')
  }

  const isLoudAnchor =
    (action === 'opened' && state.outsider) ||
    (action === 'ready_for_review' && state.outsider) ||
    (action === 'closed' && state.merged)

  const anchorCard = buildPrCard(state, repo, !isLoudAnchor)

  let replyCard: CardModel | undefined
  if (action === 'closed' && state.merged && existing) {
    const linked =
      state.linkedIssues.length > 0
        ? `Closes ${state.linkedIssues.map((n) => `#${n}`).join(', ')} · `
        : ''
    replyCard = {
      accentColor: DISCORD_COLORS.GREEN,
      stateBadge: 'Merged',
      title: `PR #${state.number} merged into main by @${actor}`,
      primaryButton: { label: 'View Merge ↗', url: state.url },
      sections: [
        `${linked}Duplicate main-push summary suppressed`,
        `**So far:** ${formatSoFar(state.timeline)}`
      ],
      footer: `${repo} · #${state.number}`,
      silent: false
    }
  } else if (
    action === 'synchronize' &&
    existing &&
    existing.timeline.includes('Changes requested')
  ) {
    replyCard = {
      accentColor: DISCORD_COLORS.VIOLET,
      stateBadge: 'Fix Pushed',
      title: `@${actor} updated PR #${state.number}`,
      primaryButton: { label: 'View Commits ↗', url: `${state.url}/commits` },
      sections: [
        `Re-review waiting on ${state.waitingOn}`,
        `**So far:** ${formatSoFar(state.timeline)}`
      ],
      footer: `${repo} · #${state.number}`,
      silent: true
    }
  }

  let triageCard: { entityKey: string; state: PrEntityState; card: CardModel } | undefined
  if (config.hasDistinctTriageChannel) {
    if (
      action === 'review_requested' &&
      event.requested_reviewer &&
      !isBotUser(event.requested_reviewer)
    ) {
      triageCard = {
        entityKey: `triage:pr:${state.number}`,
        state,
        card: buildTriagePrCard(
          state,
          repo,
          'Review Requested',
          DISCORD_COLORS.AMBER,
          [event.requested_reviewer.login],
          config
        )
      }
    } else if ((action === 'opened' || action === 'ready_for_review') && state.outsider) {
      triageCard = {
        entityKey: `triage:pr:${state.number}`,
        state,
        card: buildTriagePrCard(
          state,
          repo,
          'Outside PR Ready',
          DISCORD_COLORS.AMBER,
          Object.keys(state.reviewers),
          config
        )
      }
    }
  }

  return {
    entityKey: `pr:${state.number}`,
    state,
    anchorCard,
    replyCard,
    triageCard,
    mergedCommitSha:
      action === 'closed' && state.merged ? (pr.merge_commit_sha ?? undefined) : undefined
  }
}

export function projectPullRequestReviewEvent(
  event: GitHubPullRequestReviewEvent,
  existing: PrEntityState | null,
  config: RelayConfig
): {
  entityKey: string
  state: PrEntityState
  anchorCard: CardModel
  replyCard: CardModel
  triageCard?: { entityKey: string; state: PrEntityState; card: CardModel }
} | null {
  if (event.action !== 'submitted') return null
  const review = event.review
  const pr = event.pull_request
  if (isBotUser(review.user) || isBotUser(pr.user)) return null

  const reviewState = review.state.toLowerCase()
  const reviewer = cleanText(review.user.login)
  const outsider = isOutsider(pr.author_association)
  const excerpt = extractCommentExcerpt(review.body, 220)

  if (reviewState !== 'approved' && reviewState !== 'changes_requested') {
    if (!excerpt || !outsider) return null
  }

  const repo = event.repository.full_name
  const stepLabel =
    reviewState === 'approved'
      ? 'Approved'
      : reviewState === 'changes_requested'
        ? 'Changes requested'
        : 'Reviewed'

  const state = buildStateFromPr(pr, existing, stepLabel)
  if (reviewState === 'approved' || reviewState === 'changes_requested') {
    state.reviewers[reviewer] = reviewState
  }
  if (reviewState === 'changes_requested') {
    state.waitingOn = `@${state.author} (author fix)`
  } else if (reviewState === 'approved') {
    state.waitingOn = `@${reviewer} / merge`
  }

  const anchorCard = buildPrCard(state, repo, true)

  const replyAccent =
    reviewState === 'approved'
      ? DISCORD_COLORS.GREEN
      : reviewState === 'changes_requested'
        ? DISCORD_COLORS.AMBER
        : DISCORD_COLORS.VIOLET
  const replyBadge =
    reviewState === 'approved'
      ? 'Approved'
      : reviewState === 'changes_requested'
        ? 'Changes Requested'
        : 'Review Comment'
  const headline =
    reviewState === 'approved'
      ? `@${reviewer} approved #${state.number}`
      : reviewState === 'changes_requested'
        ? `@${reviewer} requested changes on #${state.number}`
        : `@${reviewer} reviewed #${state.number}`

  const sections: string[] = []
  if (excerpt) sections.push(`> "${excerpt}"`)
  sections.push(`**So far:** ${formatSoFar(state.timeline)}`)

  const { mentionIds } =
    reviewState === 'changes_requested'
      ? resolveUserMentions([state.author], config.discordUsers)
      : { mentionIds: [] as string[] }

  const replyCard: CardModel = {
    accentColor: replyAccent,
    stateBadge: replyBadge,
    title: truncateTitle(headline, 100),
    primaryButton: { label: 'View Review ↗', url: review.html_url || state.url },
    sections,
    footer: `${repo} · #${state.number}`,
    silent: reviewState === 'approved',
    mentionUserIds: mentionIds
  }

  let triageCard: { entityKey: string; state: PrEntityState; card: CardModel } | undefined
  if (config.hasDistinctTriageChannel && reviewState === 'changes_requested') {
    triageCard = {
      entityKey: `triage:pr:${state.number}`,
      state,
      card: buildTriagePrCard(
        state,
        repo,
        'Changes Requested',
        DISCORD_COLORS.AMBER,
        [state.author],
        config
      )
    }
  }

  return {
    entityKey: `pr:${state.number}`,
    state,
    anchorCard,
    replyCard,
    triageCard
  }
}

export function projectPrCommentEvent(
  event: GitHubIssueCommentEvent,
  existing: PrEntityState | null,
  config: RelayConfig
): {
  entityKey: string
  state: PrEntityState
  anchorCard: CardModel
  replyCard: CardModel
  triageReplyCard?: CardModel
} | null {
  if (event.action !== 'created') return null
  const c = event.comment
  if (isBotUser(c.user) || isBotUser(event.issue.user)) return null

  const outsider = isOutsider(c.author_association)
  const isAuthor = c.user.login === event.issue.user.login
  const waitingOnAuthor = existing?.waitingOn.includes(`@${existing.author}`) ?? false
  if (!outsider && !(isAuthor && waitingOnAuthor)) return null

  const excerpt = extractCommentExcerpt(c.body, 220)
  if (!excerpt) return null

  const repo = event.repository.full_name
  const commenter = cleanText(c.user.login)
  const nextCount = (existing?.commentCount ?? 0) + 1
  const timeline = appendTimeline(
    existing?.timeline ?? ['Opened'],
    isAuthor && waitingOnAuthor ? 'Author replied' : `${nextCount} comments`
  )

  const state: PrEntityState = existing
    ? {
        ...existing,
        commentCount: nextCount,
        timeline
      }
    : {
        kind: 'pr',
        number: event.issue.number,
        title: cleanText(event.issue.title),
        url: event.issue.html_url,
        author: cleanText(event.issue.user.login),
        outsider: isOutsider(event.issue.author_association),
        draft: false,
        merged: false,
        closed: event.issue.state === 'closed',
        additions: 0,
        deletions: 0,
        changedFiles: 0,
        labels: (event.issue.labels ?? []).map((l) => l.name),
        linkedIssues: extractLinkedIssues(event.issue.body),
        reviewers: {},
        ciStatus: 'unknown',
        commentCount: nextCount,
        waitingOn: 'Maintainer review',
        timeline
      }

  const replyCard: CardModel = {
    accentColor: outsider ? DISCORD_COLORS.AMBER : DISCORD_COLORS.VIOLET,
    stateBadge: outsider ? 'Contributor Reply' : 'PR Comment',
    title: `@${commenter} commented on #${state.number}`,
    primaryButton: { label: 'Jump to Comment ↗', url: c.html_url },
    sections: [`> "${excerpt}"`, `**So far:** ${formatSoFar(state.timeline)}`],
    footer: `${repo} · #${state.number}`,
    silent: !outsider
  }

  let triageReplyCard: CardModel | undefined
  if (config.hasDistinctTriageChannel && (outsider || waitingOnAuthor)) {
    const { mentionText, mentionIds } = resolveUserMentions(
      Object.keys(state.reviewers),
      config.discordUsers
    )
    triageReplyCard = {
      ...replyCard,
      sections: [
        `> "${excerpt}"`,
        `**So far:** ${formatSoFar(state.timeline)}`,
        `**Waiting on:** ${mentionText || state.waitingOn}`
      ],
      silent: false,
      mentionUserIds: mentionIds
    }
  }

  return {
    entityKey: `pr:${state.number}`,
    state,
    anchorCard: buildPrCard(state, repo, true),
    replyCard,
    triageReplyCard
  }
}
