import { changeWindowLine, contributorLine, DIGEST_CHANNEL_LINES } from './helpers'
import type {
  DigestChangedSection,
  DigestChangeRun,
  DigestDocument,
  DigestFrequency,
  DigestNotification
} from './types'

const CHANGED_NOTE = 'This document changed. Open it to see the edits.'

function shownNotice(notice: DigestNotification, fallbackUrl: string): DigestNotification {
  const message_preview = notice.message_preview.trim() || 'media'
  const action_url = notice.action_url || fallbackUrl
  if (message_preview === notice.message_preview && action_url === notice.action_url) return notice
  return { ...notice, message_preview, action_url }
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
  | { kind: 'heading'; text: string; url: string; mark?: 'added' | 'removed'; label?: string }
  | { kind: 'note'; text: string }
  | { kind: 'notice'; notice: DigestNotification }
  | { kind: 'runs'; runs: DigestChangeRun[] }
  | { kind: 'more'; count: number }
  | { kind: 'status'; line: string }
  | { kind: 'home'; url: string }

/** Equality checks only: a job queued before `status` existed paints as before. */
function headingTags(
  section: DigestChangedSection,
  runs: DigestChangeRun[]
): { mark?: 'added' | 'removed'; label?: string } {
  const mark = section.status === 'added' || section.status === 'removed' ? section.status : null
  const label =
    section.previousLevel !== undefined
      ? 'Heading level changed'
      : section.status === 'moved'
        ? 'Moved'
        : section.status === 'modified' && runs.length === 0
          ? 'Edited'
          : null
  return { ...(mark ? { mark } : {}), ...(label ? { label } : {}) }
}

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
    const sections = doc.content_changes?.sections ?? []
    // A Change digest block with no sections means no detail could be computed or placed.
    if (doc.content_changes && sections.length === 0) {
      blocks.push({ kind: 'note', text: CHANGED_NOTE })
    }
    for (const section of sections) {
      const runs = section.runs ?? []
      blocks.push({
        kind: 'heading',
        text: section.text || 'Untitled heading',
        url: section.url,
        ...headingTags(section, runs)
      })
      for (const notice of section.chats ?? []) {
        blocks.push({ kind: 'notice', notice: shownNotice(notice, section.url) })
      }
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
