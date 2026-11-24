import { DISCORD_COLORS } from '../discord/renderer.ts'
import { cleanText, truncateTitle } from '../security.ts'
import type { CardModel, DigestSnapshot, RelayConfig } from '../types.ts'

export function buildDailyTriageDigest(
  snapshot: DigestSnapshot,
  config: RelayConfig
): CardModel | null {
  const totalAttention =
    snapshot.awaitingReviewPrs.length +
    snapshot.unansweredExternalIssues.length +
    snapshot.staleClaimedIssues.length +
    snapshot.dependabotOpenPrs.length

  if (totalAttention === 0) return null

  const sections: string[] = []

  if (snapshot.awaitingReviewPrs.length > 0) {
    const lines = snapshot.awaitingReviewPrs.slice(0, 5).map((pr) => {
      const ci = pr.ciStatus === 'passed' ? '✅' : pr.ciStatus === 'failed' ? '❌' : '⏳'
      return `- [#${pr.number}](${pr.url}) ${truncateTitle(pr.title, 65)} · ${pr.ageHours}h · CI ${ci} · Waiting on: ${cleanText(pr.waitingOn)}`
    })
    sections.push(`**PRs waiting on review (> 24h)**\n${lines.join('\n')}`)
  }

  if (snapshot.unansweredExternalIssues.length > 0) {
    const lines = snapshot.unansweredExternalIssues.slice(0, 5).map((item) => {
      const kindTag = item.kind === 'discussion' ? 'Discussion' : 'Issue'
      return `- [${kindTag} #${item.number}](${item.url}) ${truncateTitle(item.title, 65)} · ${item.ageHours}h · by \`@${cleanText(item.author)}\``
    })
    sections.push(`**Unanswered contributor questions (> 24h)**\n${lines.join('\n')}`)
  }

  if (snapshot.staleClaimedIssues.length > 0) {
    const lines = snapshot.staleClaimedIssues.slice(0, 4).map((item) => {
      return `- [#${item.number}](${item.url}) ${truncateTitle(item.title, 65)} · claimed by \`@${cleanText(item.assignee)}\` (${item.ageDays}d ago)`
    })
    sections.push(`**Stale claimed issues (> 7d)**\n${lines.join('\n')}`)
  }

  const dependabotNote =
    snapshot.dependabotOpenPrs.length > 0
      ? `${snapshot.dependabotOpenPrs.length} open Dependabot PRs (${snapshot.dependabotOpenPrs
          .slice(0, 5)
          .map((n) => `#${n}`)
          .join(', ')})`
      : 'Zero open Dependabot PRs'

  const actionCount =
    snapshot.awaitingReviewPrs.length +
    snapshot.unansweredExternalIssues.length +
    snapshot.staleClaimedIssues.length

  return {
    accentColor: DISCORD_COLORS.AMBER,
    stateBadge: 'Daily Triage',
    title:
      actionCount > 0
        ? `${actionCount} items need maintainer attention`
        : `${snapshot.dependabotOpenPrs.length} dependency PRs pending`,
    primaryButton: {
      label: 'Open PR Queue ↗',
      url: `https://github.com/${config.githubRepository}/pulls`
    },
    sections,
    footer: `${snapshot.repo} · ${dependabotNote}`,
    silent: true
  }
}

export function buildWeeklyPulse(snapshot: DigestSnapshot, config: RelayConfig): CardModel | null {
  if (snapshot.weeklyMergedPrs.length === 0 && snapshot.weeklyClosedIssuesCount === 0) {
    return null
  }

  const contributors = Array.from(
    new Set(snapshot.weeklyMergedPrs.map((p) => `@${cleanText(p.author)}`))
  )
  const contribLine =
    contributors.length > 0 ? contributors.slice(0, 8).join(', ') : 'Maintainer team'

  const sections: string[] = [
    `**Merged:** ${snapshot.weeklyMergedPrs.length} PRs · **Closed:** ${snapshot.weeklyClosedIssuesCount} issues · **Contributors:** ${contribLine}`
  ]

  if (snapshot.featuredClaimableIssues.length > 0) {
    const lines = snapshot.featuredClaimableIssues.map((item) => {
      const chips = item.labels
        .slice(0, 2)
        .map((l) => `\`${cleanText(l)}\``)
        .join(' ')
      return `- [#${item.number}](${item.url}) ${truncateTitle(item.title, 70)} ${chips}`.trim()
    })
    sections.push(`**Featured Up for grabs**\n${lines.join('\n')}`)
  }

  return {
    accentColor: DISCORD_COLORS.SLATE,
    stateBadge: 'Weekly Pulse',
    title: `Weekly shipped recap · ${config.githubRepository}`,
    primaryButton: {
      label: 'Contributors ↗',
      url: `https://github.com/${config.githubRepository}/graphs/contributors`
    },
    sections,
    footer: `${snapshot.repo} · ${snapshot.starsCount} stars · Auto-skips quiet weeks`,
    silent: true
  }
}
