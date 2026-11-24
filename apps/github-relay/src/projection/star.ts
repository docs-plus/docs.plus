import { DISCORD_COLORS } from '../discord/renderer.ts'
import { cleanText } from '../security.ts'
import type { CardModel, StarBatchItem } from '../types.ts'

const FIXED_MILESTONES = new Set([100, 150, 200, 250, 500, 1000])

export function isStarMilestone(count: number): boolean {
  if (count <= 0) return false
  if (FIXED_MILESTONES.has(count)) return true
  return count > 1000 && count % 500 === 0
}

export function buildStarCard(items: StarBatchItem[], repo: string): CardModel | null {
  if (items.length === 0) return null

  const sorted = [...items].sort((a, b) => a.stargazersCount - b.stargazersCount)
  const latest = sorted[sorted.length - 1]
  const totalCount = latest.stargazersCount
  const stargazersUrl = `https://github.com/${repo}/stargazers`
  const goodFirstIssuesUrl = `https://github.com/${repo}/issues?q=is%3Aopen+label%3A%22good+first+issue%22`

  const milestoneItem = sorted.find((item) => isStarMilestone(item.stargazersCount))
  if (milestoneItem) {
    const milestoneCount = milestoneItem.stargazersCount
    const milestoneUser = cleanText(milestoneItem.login)
    const extraNames = sorted
      .filter((i) => i.login !== milestoneItem.login)
      .slice(0, 5)
      .map((i) => `\`@${cleanText(i.login)}\``)
    const extraLine = extraNames.length > 0 ? `\nAlso starred: ${extraNames.join(', ')}` : ''

    return {
      accentColor: DISCORD_COLORS.GOLD,
      stateBadge: `Milestone · ${milestoneCount} Stars!`,
      title: `🌟 ${repo} crossed ${milestoneCount} stars!`,
      primaryButton: { label: 'View Stargazers ↗', url: stargazersUrl },
      sections: [
        `Star #${milestoneCount} from [\`@${milestoneUser}\`](https://github.com/${milestoneUser}). Thank you to everyone backing docs.plus!${extraLine}`
      ],
      buttons: [{ label: 'Good First Issues ↗', url: goodFirstIssuesUrl }],
      footer: `${repo} · Current total: ${totalCount} stars`,
      silent: false
    }
  }

  if (sorted.length === 1) {
    const login = cleanText(latest.login)
    const countPart = totalCount > 0 ? ` · #${totalCount}` : ''
    const nextHint = totalCount > 0 && totalCount < 100 ? `${100 - totalCount} away from 100` : repo
    return {
      accentColor: DISCORD_COLORS.SLATE,
      stateBadge: `New Star${countPart}`,
      title: `⭐ @${login} starred ${repo}`,
      primaryButton: { label: 'Stargazers ↗', url: stargazersUrl },
      sections: [],
      footer: `${nextHint} · 24h toggle cooldown active`,
      silent: true
    }
  }

  const names = sorted
    .slice(0, 8)
    .map((i) => `\`@${cleanText(i.login)}\``)
    .join(', ')
  const more = sorted.length > 8 ? ` +${sorted.length - 8} more` : ''
  const totalPart = totalCount > 0 ? ` (now ${totalCount})` : ''

  return {
    accentColor: DISCORD_COLORS.GOLD,
    stateBadge: `Star Burst · +${sorted.length}`,
    title: `⭐ ${sorted.length} new stars on ${repo}${totalPart}`,
    primaryButton: { label: 'Stargazers ↗', url: stargazersUrl },
    sections: [`From ${names}${more}`],
    footer: `${repo} · Coalesced in burst window`,
    silent: true
  }
}
