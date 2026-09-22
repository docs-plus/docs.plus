import type { EmailFooter } from './helpers'
import { buildDigestEmail } from './templates'
import type {
  DigestChangedSection,
  DigestChangeRun,
  DigestDocument,
  DigestFrequency
} from './types'

/** Gmail clips a mail near 102KB. Stop short of that. */
export const DEFAULT_DIGEST_MAX_BYTES = 90 * 1024

export interface DigestFitParams {
  recipientName: string
  frequency: DigestFrequency
  documents: DigestDocument[]
  periodEnd: string
  footer?: EmailFooter
}

function joined(runs: readonly DigestChangeRun[]): string {
  return runs.map((run) => run.text).join('')
}

/** The first sentence, so a long passage can shrink without losing the edit. */
function firstSentence(runs: readonly DigestChangeRun[]): DigestChangeRun[] {
  let seen = ''
  const kept: DigestChangeRun[] = []
  for (const run of runs) {
    const next = seen + run.text
    const match = /[.!?](?:\s|$)/.exec(next)
    if (match?.index === undefined) {
      kept.push(run)
      seen = next
      continue
    }
    const take = match.index + 1 - seen.length
    if (take >= run.text.length) {
      kept.push(run)
      return kept
    }
    const head = run.text.slice(0, Math.max(take, 0)).trimEnd()
    if (head) kept.push({ kind: run.kind, text: head })
    return kept
  }
  return kept
}

function sectionChanged(section: DigestChangedSection): boolean {
  return Boolean(section.runs?.length || section.excerpt || section.removed)
}

function dropOldestChat(documents: DigestDocument[]): DigestDocument[] | null {
  let best: { doc: number; section: number; chat: number; at: string } | null = null
  for (let docIndex = 0; docIndex < documents.length; docIndex++) {
    const sections = documents[docIndex]?.content_changes?.sections
    if (!sections) continue
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      const chats = sections[sectionIndex]?.chats
      if (!chats) continue
      for (let chatIndex = 0; chatIndex < chats.length; chatIndex++) {
        const at = chats[chatIndex]?.at
        if (at === undefined) continue
        if (!best || at < best.at) {
          best = { doc: docIndex, section: sectionIndex, chat: chatIndex, at }
        }
      }
    }
  }
  if (!best) return null
  const target = best
  return documents.map((doc, docIndex) => {
    if (docIndex !== target.doc || !doc.content_changes?.sections) return doc
    const sections = doc.content_changes.sections.flatMap((section, sectionIndex) => {
      if (sectionIndex !== target.section) return [section]
      const chats = (section.chats ?? []).filter((_, chatIndex) => chatIndex !== target.chat)
      const next = chats.length > 0 ? { ...section, chats } : { ...section, chats: undefined }
      if (!sectionChanged(next) && chats.length === 0) return []
      return [next]
    })
    return { ...doc, content_changes: { ...doc.content_changes, sections } }
  })
}

function shortenOnePassage(documents: DigestDocument[]): DigestDocument[] | null {
  for (let docIndex = 0; docIndex < documents.length; docIndex++) {
    const sections = documents[docIndex]?.content_changes?.sections
    if (!sections) continue
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      const runs = sections[sectionIndex]?.runs
      if (!runs?.length) continue
      const short = firstSentence(runs)
      if (joined(short).length >= joined(runs).length) continue
      return documents.map((doc, index) => {
        if (index !== docIndex || !doc.content_changes?.sections) return doc
        const nextSections = doc.content_changes.sections.map((section, at) =>
          at === sectionIndex ? { ...section, runs: short } : section
        )
        return { ...doc, content_changes: { ...doc.content_changes, sections: nextSections } }
      })
    }
  }
  return null
}

/**
 * Shrink a digest until the HTML fits. Oldest chats go first. A long passage
 * then keeps its first sentence. A heading that changed is never removed.
 */
export function fitDigestDocuments(params: DigestFitParams, maxBytes: number): DigestDocument[] {
  let documents = structuredClone(params.documents)
  for (let step = 0; step < 500; step++) {
    const { html } = buildDigestEmail({ ...params, documents })
    if (Buffer.byteLength(html, 'utf8') <= maxBytes) return documents
    const next = dropOldestChat(documents) ?? shortenOnePassage(documents)
    if (!next) return documents
    documents = next
  }
  return documents
}
