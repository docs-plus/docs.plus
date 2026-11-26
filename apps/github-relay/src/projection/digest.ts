import { DISCORD_COLORS } from '../discord/renderer.ts'
import { cleanText, truncateTitle } from '../security.ts'
import type { CardModel, DigestSnapshot, PeriodReportSnapshot, RelayConfig } from '../types.ts'

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

export function isBiweeklyReportDue(now: Date, config: RelayConfig): boolean {
  if (
    now.getUTCDay() !== config.biweeklyReportDayUtc ||
    now.getUTCHours() !== config.biweeklyReportHourUtc
  ) {
    return false
  }
  const epochDay = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000
  )
  const weekIndex = Math.floor((epochDay - config.biweeklyReportDayUtc) / 7)
  return ((weekIndex % 2) + 2) % 2 === 0
}

export function isMonthlyReportDue(now: Date, config: RelayConfig): boolean {
  return (
    now.getUTCDate() === config.monthlyReportDayUtc &&
    now.getUTCHours() === config.monthlyReportHourUtc
  )
}

export function computeReportWindow(
  kind: 'biweekly' | 'monthly',
  now: Date
): { sinceMs: number; untilMs: number; periodLabel: string; runKey: string } {
  if (kind === 'biweekly') {
    const untilMs = now.getTime()
    const sinceMs = untilMs - 14 * 86_400_000
    const start = new Date(sinceMs)
    const fmt = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    })
    const startYear = start.getUTCFullYear()
    const endYear = now.getUTCFullYear()
    const periodLabel =
      startYear === endYear
        ? `${fmt.format(start)} – ${fmt.format(now)}, ${endYear}`
        : `${fmt.format(start)}, ${startYear} – ${fmt.format(now)}, ${endYear}`
    return {
      sinceMs,
      untilMs,
      periodLabel,
      runKey: `biweekly:${now.toISOString().slice(0, 10)}`
    }
  }

  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0))
  const currStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  const periodLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(prevStart)

  return {
    sinceMs: prevStart.getTime(),
    untilMs: currStart.getTime(),
    periodLabel,
    runKey: `monthly:${prevStart.toISOString().slice(0, 7)}`
  }
}

export function buildPeriodReportCard(
  snapshot: PeriodReportSnapshot,
  config: RelayConfig
): CardModel | null {
  if (
    snapshot.commitsCount === 0 &&
    snapshot.releases.length === 0 &&
    snapshot.mergedPrsCount === 0 &&
    snapshot.closedIssuesCount === 0
  ) {
    return null
  }

  const isMonthly = snapshot.kind === 'monthly'
  const commitsLabel = snapshot.commitsCapped
    ? `${snapshot.commitsCount}+`
    : String(snapshot.commitsCount)

  const formattedContributors = snapshot.contributors
    .slice(0, 8)
    .map((c) => {
      const cleaned = cleanText(c)
      if (!cleaned) return ''
      return cleaned.includes(' ') ? cleaned : `@${cleaned}`
    })
    .filter(Boolean)
  const contribLine =
    formattedContributors.length > 0 ? formattedContributors.join(', ') : 'Maintainer team'

  const sections: string[] = [
    `**Commits:** ${commitsLabel} · **Releases:** ${snapshot.releases.length} · **Merged PRs:** ${snapshot.mergedPrsCount} · **Closed issues:** ${snapshot.closedIssuesCount}\n**Contributors:** ${contribLine}`
  ]

  if (snapshot.releases.length > 0) {
    const releaseLines = snapshot.releases.slice(0, 5).map((r) => {
      const tag = cleanText(r.tagName)
      const name = cleanText(r.name)
      if (!name || name === tag) {
        return `- [\`${tag}\`](${r.url})`
      }
      return `- [\`${tag}\`](${r.url}) ${truncateTitle(name, 65)}`
    })
    if (snapshot.releases.length > 5) {
      releaseLines.push(`- …and ${snapshot.releases.length - 5} more`)
    }
    sections.push(`**Releases**\n${releaseLines.join('\n')}`)
  }

  if (snapshot.featuredClaimableIssues.length > 0) {
    const lines = snapshot.featuredClaimableIssues.slice(0, 4).map((item) => {
      const chips = item.labels
        .slice(0, 2)
        .map((l) => `\`${cleanText(l)}\``)
        .join(' ')
      return `- [#${item.number}](${item.url}) ${truncateTitle(item.title, 70)} ${chips}`.trim()
    })
    sections.push(`**Up for grabs**\n${lines.join('\n')}`)
  }

  return {
    accentColor: isMonthly ? DISCORD_COLORS.VIOLET : DISCORD_COLORS.SKY,
    stateBadge: isMonthly ? 'Monthly Report' : '2-Week Report',
    title: isMonthly
      ? `${snapshot.periodLabel} recap · ${config.githubRepository}`
      : `Shipped recap · ${snapshot.periodLabel}`,
    primaryButton: {
      label: 'Contributors ↗',
      url: `https://github.com/${config.githubRepository}/graphs/contributors`
    },
    sections,
    footer: `${snapshot.repo} · ${snapshot.starsCount} stars · ${isMonthly ? 'Monthly recap' : 'Every 2 weeks'}`,
    silent: true
  }
}
