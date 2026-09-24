import { changeWindowLine, contributorLine, DIGEST_CHANNEL_LINES } from './helpers'
import type { DigestChangeRun, DigestDocument, DigestFrequency, DigestNotification } from './types'

function shownNotice(notice: DigestNotification, fallbackUrl: string): DigestNotification {
  const message_preview = notice.message_preview.trim() || 'media'
  const action_url = notice.action_url || fallbackUrl
  if (message_preview === notice.message_preview && action_url === notice.action_url) return notice
  return { ...notice, message_preview, action_url }
}

function passageRuns(section: {
  runs?: DigestChangeRun[]
  excerpt?: string
  removed?: string
}): DigestChangeRun[] {
  if (section.runs?.length) return section.runs
  const runs: DigestChangeRun[] = []
  if (section.excerpt) runs.push({ kind: 'added', text: section.excerpt })
  if (section.removed) runs.push({ kind: 'removed', text: section.removed })
  return runs
}

export type DigestBlock =
  | {
      kind: 'sheet'
      name: string
      url: string
      badge: number
      recipientName: string
      notificationsUrl: string
    }
  | { kind: 'heading'; text: string; url: string }
  | { kind: 'notice'; notice: DigestNotification }
  | { kind: 'runs'; runs: DigestChangeRun[] }
  | { kind: 'more'; count: number }
  | { kind: 'status'; line: string }
  | { kind: 'home'; url: string }

export function walkDigest(input: {
  documents: readonly DigestDocument[]
  frequency: DigestFrequency
  periodEnd: string
  recipientName: string
  totalNotifications: number
  notificationsUrl: string
}): DigestBlock[] {
  const blocks: DigestBlock[] = []
  if (input.documents.length === 0) {
    blocks.push({ kind: 'home', url: input.notificationsUrl })
    return blocks
  }

  for (const doc of input.documents) {
    blocks.push({
      kind: 'sheet',
      name: doc.name,
      url: doc.url,
      badge: input.totalNotifications,
      recipientName: input.recipientName,
      notificationsUrl: input.notificationsUrl
    })
    for (const section of doc.content_changes?.sections ?? []) {
      blocks.push({ kind: 'heading', text: section.text, url: section.url })
      for (const notice of section.chats ?? []) {
        blocks.push({ kind: 'notice', notice: shownNotice(notice, section.url) })
      }
      const runs = passageRuns(section)
      if (runs.length) blocks.push({ kind: 'runs', runs })
    }
    for (const channel of doc.channels) {
      blocks.push({ kind: 'heading', text: `# ${channel.name}`, url: channel.url })
      const shown = channel.notifications.slice(0, DIGEST_CHANNEL_LINES)
      for (const notice of shown) {
        blocks.push({ kind: 'notice', notice: shownNotice(notice, channel.url) })
      }
      const extra = channel.notifications.length - shown.length
      if (extra > 0) blocks.push({ kind: 'more', count: extra })
    }
    const changes = doc.content_changes
    const windowLine = changes
      ? changeWindowLine(changes.since, changes.fromLastLeft, input.frequency, input.periodEnd)
      : ''
    const contributors = changes ? contributorLine(changes.contributorCount) : ''
    blocks.push({ kind: 'status', line: [windowLine, contributors].filter(Boolean).join(' ') })
  }
  return blocks
}
