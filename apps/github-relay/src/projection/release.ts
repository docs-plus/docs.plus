import { DISCORD_COLORS } from '../discord/renderer.ts'
import {
  cleanText,
  stripHtmlAndExtractBanner,
  truncateMarkdownSafe,
  truncateTitle
} from '../security.ts'
import type {
  CardButton,
  CardModel,
  GitHubReleaseEvent,
  RelayConfig,
  ReleaseEntityState
} from '../types.ts'

interface ParsedReleaseTag {
  kind: 'extension' | 'product' | 'generic'
  pkg: string
  version: string
  extensionDir?: string
}

function parseReleaseTag(tagName: string, repo: string): ParsedReleaseTag {
  const pkgMatch = /^(@?[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)?)@(.+)$/.exec(tagName)
  if (pkgMatch) {
    const pkg = pkgMatch[1]
    const version = pkgMatch[2]
    const extensionDir = pkg.startsWith('@docs.plus/extension-')
      ? pkg.slice('@docs.plus/'.length)
      : undefined
    return { kind: 'extension', pkg, version, extensionDir }
  }

  const verMatch = /^v(.+)$/.exec(tagName)
  if (verMatch) {
    return { kind: 'product', pkg: repo, version: verMatch[1] }
  }

  return { kind: 'generic', pkg: repo, version: tagName }
}

export function buildReleaseProjection(
  event: GitHubReleaseEvent,
  config: RelayConfig
): { entityKey: string; state: ReleaseEntityState; card: CardModel } | null {
  const action = event.action
  if (!['published', 'prereleased', 'edited'].includes(action)) return null

  const rel = event.release
  if (rel.draft) return null

  const repo = event.repository.full_name || config.githubRepository
  const parsed = parseReleaseTag(rel.tag_name, repo)
  const prerelease = Boolean(rel.prerelease)
  const rawName = cleanText(rel.name || rel.tag_name)
  const author = cleanText(rel.author?.login || event.sender?.login || 'docs-plus')

  const { text: strippedBody, bannerUrl } = stripHtmlAndExtractBanner(rel.body ?? '')
  const { text: bodyText, truncated } = truncateMarkdownSafe(strippedBody, 2200)
  const bodySection = truncated
    ? `${bodyText}\n\n[Read full release notes ↗](${rel.html_url})`
    : bodyText

  const sections: string[] = []
  if (bodySection) sections.push(bodySection)

  const buttons: CardButton[] = []
  let badge = prerelease ? 'Pre-release' : 'Product Release'

  if (parsed.kind === 'extension') {
    badge = prerelease ? 'Extension Pre-release' : 'Extension Release'
    const safeVersion = cleanText(parsed.version).replace(/`/g, '')
    sections.push(`\`\`\`bash\nnpm install ${parsed.pkg}@${safeVersion}\n\`\`\``)
    buttons.push({ label: 'View on npm ↗', url: `https://www.npmjs.com/package/${parsed.pkg}` })
    if (parsed.extensionDir) {
      buttons.push({
        label: 'CHANGELOG ↗',
        url: `https://github.com/${repo}/blob/main/extensions/${parsed.extensionDir}/CHANGELOG.md`
      })
    }
  } else if (parsed.kind === 'product') {
    buttons.push({ label: 'Try docs.plus ↗', url: config.appUrl })
    buttons.push({ label: 'Self-Host Upgrade ↗', url: config.selfHostDocsUrl })
  }

  buttons.push({
    label: 'Compare Diff ↗',
    url: `https://github.com/${repo}/releases/tag/${encodeURIComponent(rel.tag_name)}`
  })

  const editedNote = action === 'edited' ? ' · updated via release.edited' : ''
  const titlePrefix = parsed.kind === 'product' ? '🚀 ' : ''

  const card: CardModel = {
    accentColor: prerelease ? DISCORD_COLORS.AMBER : DISCORD_COLORS.GREEN,
    stateBadge: badge,
    title: truncateTitle(`${titlePrefix}${rawName}`, 100),
    primaryButton: { label: 'Release Notes ↗', url: rel.html_url },
    bannerImageUrl: bannerUrl,
    sections,
    buttons,
    footer: `Tag: ${rel.tag_name} · Published by @${author}${editedNote}`,
    silent: action === 'edited'
  }

  const state: ReleaseEntityState = {
    kind: 'release',
    id: rel.id,
    tagName: rel.tag_name,
    name: rawName,
    url: rel.html_url,
    author,
    prerelease,
    publishedAt: rel.published_at || new Date().toISOString(),
    body: bodyText
  }

  return {
    entityKey: `release:${rel.id}`,
    state,
    card
  }
}
