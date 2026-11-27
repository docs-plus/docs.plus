import { DISCORD_COLORS } from '../discord/renderer.ts'
import { cleanText, extractCommentExcerpt, truncateTitle } from '../security.ts'
import type {
  CardModel,
  DiscussionEntityState,
  GitHubDiscussionCommentEvent,
  GitHubDiscussionEvent
} from '../types.ts'
import { appendTimeline, formatSoFar, isBotUser, isOutsider } from './helpers.ts'

function buildDiscussionCard(
  state: DiscussionEntityState,
  repo: string,
  silent: boolean
): CardModel {
  const accentColor = state.answered
    ? DISCORD_COLORS.GREEN
    : state.closed
      ? DISCORD_COLORS.SLATE
      : DISCORD_COLORS.SKY

  const badge = state.answered
    ? 'Discussion Answered'
    : state.closed
      ? 'Discussion Closed'
      : `Discussion · ${state.category}`

  const statusText = state.answered
    ? `✅ Answered${state.answeredBy ? ` by @${state.answeredBy}` : ''}`
    : state.closed
      ? 'Closed'
      : `Open · ${state.commentCount} ${state.commentCount === 1 ? 'reply' : 'replies'}`

  const outsiderLabel = state.outsider ? ' (outside contributor)' : ''

  return {
    accentColor,
    stateBadge: badge,
    title: truncateTitle(`💬 #${state.number} ${state.title}`, 100),
    primaryButton: { label: 'Open Discussion ↗', url: state.url },
    sections: [`Category: \`${state.category}\` · Status: **${statusText}**`],
    footer: `${repo} · started by @${state.author}${outsiderLabel}`,
    silent
  }
}

export function projectDiscussionEvent(
  event: GitHubDiscussionEvent,
  existing: DiscussionEntityState | null
): {
  entityKey: string
  state: DiscussionEntityState
  anchorCard: CardModel
  replyCard?: CardModel
} | null {
  const d = event.discussion
  if (isBotUser(d.user)) return null

  const action = event.action
  if (!['created', 'answered', 'closed', 'reopened'].includes(action)) return null

  const repo = event.repository.full_name
  const outsider = isOutsider(d.author_association)
  const category = cleanText(d.category?.name || 'General')
  const actor = cleanText(event.sender?.login || d.user.login)

  let timeline = existing?.timeline ?? ['Idea posted']
  if (action === 'answered') {
    timeline = appendTimeline(timeline, 'Answer marked')
  } else if (action === 'closed') {
    timeline = appendTimeline(timeline, 'Closed')
  } else if (action === 'reopened') {
    timeline = appendTimeline(timeline, 'Reopened')
  }

  const state: DiscussionEntityState = {
    kind: 'discussion',
    number: d.number,
    title: cleanText(d.title),
    url: d.html_url,
    author: cleanText(d.user.login),
    outsider,
    category,
    answered: action === 'answered' ? true : Boolean(existing?.answered || d.answer_chosen_at),
    answeredBy:
      action === 'answered'
        ? cleanText(d.answer_chosen_by?.login || actor)
        : (existing?.answeredBy ?? null),
    closed: action === 'closed' ? true : action === 'reopened' ? false : Boolean(existing?.closed),
    commentCount: existing?.commentCount ?? d.comments ?? 0,
    timeline
  }

  const silentAnchor = action === 'created' ? !outsider : true
  const anchorCard = buildDiscussionCard(state, repo, silentAnchor)

  let replyCard: CardModel | undefined
  if (action === 'answered' && existing) {
    const excerpt = extractCommentExcerpt(event.answer?.body, 220)
    const soFar = formatSoFar(state.timeline)
    const sections: string[] = []
    if (excerpt) sections.push(`> "${excerpt}"`)
    if (soFar) sections.push(`**So far:** ${soFar}`)

    replyCard = {
      accentColor: DISCORD_COLORS.GREEN,
      stateBadge: 'Marked Answer',
      title: `@${actor} marked an answer on #${d.number}`,
      primaryButton: { label: 'View Answer ↗', url: event.answer?.html_url || d.html_url },
      sections,
      footer: `${repo} · Discussion #${d.number}`,
      silent: false
    }
  }

  return {
    entityKey: `discussion:${d.number}`,
    state,
    anchorCard,
    replyCard
  }
}

export function projectDiscussionCommentEvent(
  event: GitHubDiscussionCommentEvent,
  existing: DiscussionEntityState | null
): {
  entityKey: string
  state: DiscussionEntityState
  anchorCard: CardModel
  replyCard: CardModel
} | null {
  if (event.action !== 'created') return null
  const c = event.comment
  if (isBotUser(c.user)) return null

  const outsider = isOutsider(c.author_association)
  if (!outsider && !existing) return null

  const d = event.discussion
  const repo = event.repository.full_name
  const commenter = cleanText(c.user.login)
  const newCount = (existing?.commentCount ?? d.comments ?? 0) + 1
  const timeline = appendTimeline(
    existing?.timeline ?? ['Posted'],
    `${newCount} ${newCount === 1 ? 'reply' : 'replies'}`
  )

  const state: DiscussionEntityState = {
    kind: 'discussion',
    number: d.number,
    title: cleanText(d.title),
    url: d.html_url,
    author: cleanText(d.user.login),
    outsider: existing?.outsider ?? isOutsider(d.author_association),
    category: existing?.category ?? cleanText(d.category?.name || 'General'),
    answered: existing?.answered ?? Boolean(d.answer_chosen_at),
    answeredBy: existing?.answeredBy ?? null,
    closed: existing?.closed ?? false,
    commentCount: newCount,
    timeline
  }

  const excerpt = extractCommentExcerpt(c.body, 220)
  const soFar = formatSoFar(state.timeline)
  const sections: string[] = []
  if (excerpt) sections.push(`> "${excerpt}"`)
  if (soFar) sections.push(`**So far:** ${soFar}`)

  const replyCard: CardModel = {
    accentColor: DISCORD_COLORS.SKY,
    stateBadge: outsider ? 'External Reply' : 'Discussion Reply',
    title: `@${commenter} replied to Discussion #${d.number}`,
    primaryButton: { label: 'View Reply ↗', url: c.html_url || d.html_url },
    sections,
    footer: `${repo} · Discussion #${d.number}`,
    silent: !outsider
  }

  return {
    entityKey: `discussion:${d.number}`,
    state,
    anchorCard: buildDiscussionCard(state, repo, true),
    replyCard
  }
}
