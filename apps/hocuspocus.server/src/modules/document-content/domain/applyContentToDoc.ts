import type * as Y from 'yjs'

import { isRecord } from '../../../lib/isRecord'
import type { ApplyMode } from '../types'
import { CONTENT_APPLY_ORIGIN } from '../types'
import { isMediaHref } from './media'
import { liveDocJson } from './readContent'
import { findSection, type Section } from './sections'
import { findUniqueText, INLINE_NODE_CHAR } from './textRuns'

/** A write inside one section. `blocks` needs `from` and `to`; `text` needs `oldText`. */
export interface SectionTarget {
  sectionId: string
  rev: string
  from?: number
  to?: number
  oldText?: string
  newText?: string
}

type DocApplyRefusal = { ok: false; status: 'conflict' | 'invalid-content'; detail: string }

/** `rev` is the section's rev after a text edit; a block edit renumbers blocks, so it has none. */
export type DocApplyResult = { ok: true; rev?: string } | DocApplyRefusal

type BodyNode = Y.XmlElement | Y.XmlText

const invalid = (detail: string): DocApplyRefusal => ({
  ok: false,
  status: 'invalid-content',
  detail
})

// Duck-typed, not instanceof: the transformer may resolve its own copy of yjs.
const sourceHeadingLevel = (node: BodyNode): number | null =>
  'nodeName' in node && node.nodeName === 'heading' ? Number(node.getAttribute('level')) : null

const isXmlText = (node: BodyNode): node is Y.XmlText => 'toDelta' in node

type DeltaOp = { insert: unknown; attributes?: Record<string, unknown> }
const deltaOf = (run: Y.XmlText): DeltaOp[] => run.toDelta() as DeltaOp[]
const opLength = (op: DeltaOp): number => (typeof op.insert === 'string' ? op.insert.length : 1)

/** Decided on the live fragment before anything mutates. */
const locateSection = (doc: Y.Doc, target: SectionTarget): Section | DocApplyRefusal => {
  const json = liveDocJson(doc)
  const section = findSection(json, target.sectionId)
  if (!section) return { ok: false, status: 'conflict', detail: 'section not found' }
  if (section.rev !== target.rev)
    return { ok: false, status: 'conflict', detail: 'section changed' }

  // One JSON entry per fragment item, so the indices carry over. A mismatch
  // means the mapping broke, and a splice would land on the wrong nodes.
  if ((json.content ?? []).length !== doc.getXmlFragment('default').length) {
    return { ok: false, status: 'conflict', detail: 'section could not be addressed' }
  }
  return section
}

/** Where `blocks` puts the new nodes, or why it cannot. */
const blockSpan = (
  section: Section,
  source: BodyNode[],
  target: SectionTarget
): { start: number; end: number } | DocApplyRefusal => {
  const { from, to } = target
  const blocks = section.end - section.start
  if (from === undefined || to === undefined || from < 0 || from > to || to > blocks) {
    return invalid(`the block range is outside this section, which has ${blocks} block(s)`)
  }
  if (from === to && source.length === 0) return invalid('nothing to insert or delete')

  // Read the source nodes, not clones: a clone holds its attributes as pending values.
  // The flat schema: a heading owns every later block up to the next heading.
  // One at or above the target re-parents the subsections after it; one before
  // the end of the body silently moves the blocks behind it into a new subsection.
  const levels = source.map(sourceHeadingLevel).filter((level) => level !== null)
  if (levels.some((level) => level <= section.level)) {
    return invalid(`a new heading must be deeper than level ${section.level}`)
  }
  if (levels.length > 0 && to !== blocks) {
    return invalid('a new heading can only go at the end of the section')
  }
  return { start: section.start + from, end: section.start + to }
}

const textRunsOf = (nodes: BodyNode[]): Y.XmlText[] =>
  nodes.flatMap((node) => (isXmlText(node) ? [node] : textRunsOf(node.toArray() as BodyNode[])))

const plainText = (run: Y.XmlText): string =>
  deltaOf(run)
    .map((op) => (typeof op.insert === 'string' ? op.insert : INLINE_NODE_CHAR))
    .join('')

/** The marks on the character at one offset; none past the end. */
const attributesAt = (run: Y.XmlText, offset: number): Record<string, unknown> => {
  let at = 0
  for (const op of deltaOf(run)) {
    at += opLength(op)
    if (offset < at) return op.attributes ?? {}
  }
  return {}
}

/** Only marks on both sides continue into an insert, so text after a link never joins the link. */
const caretAttributes = (run: Y.XmlText, offset: number): Record<string, unknown> => {
  const left = offset > 0 ? attributesAt(run, offset - 1) : {}
  const right = attributesAt(run, offset)
  return Object.fromEntries(
    Object.entries(left).filter(
      ([key, value]) => key in right && JSON.stringify(right[key]) === JSON.stringify(value)
    )
  )
}

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff
const isLowSurrogate = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff

/**
 * The words an agent repeats around its change are not rewritten. This keeps
 * their marks and Yjs items, and turns a pure insert into a caret insert. It
 * never cuts between a surrogate pair: Yjs turns a split half into U+FFFD.
 */
const trimShared = (oldText: string, newText: string): { head: number; tail: number } => {
  let head = 0
  while (head < oldText.length && head < newText.length && oldText[head] === newText[head]) head++
  if (head > 0 && isHighSurrogate(oldText.charCodeAt(head - 1))) head--
  let tail = 0
  while (
    tail < oldText.length - head &&
    tail < newText.length - head &&
    oldText[oldText.length - 1 - tail] === newText[newText.length - 1 - tail]
  )
    tail++
  if (tail > 0 && isLowSurrogate(oldText.charCodeAt(oldText.length - tail))) tail--
  return { head, tail }
}

/** A file attachment is a media link on its name, so removing that text removes the file. */
const removesMediaLink = (run: Y.XmlText, from: number, length: number): boolean => {
  let at = 0
  for (const op of deltaOf(run)) {
    const end = at + opLength(op)
    const overlaps = at < from + length && end > from
    const media = Object.values(op.attributes ?? {}).some(
      (mark) => isRecord(mark) && isMediaHref(mark.href)
    )
    if (overlaps && media) return true
    at = end
  }
  return false
}

const markApplied = (doc: Y.Doc): void => {
  const metadata = doc.getMap('metadata')
  metadata.set('isDraft', false)
  metadata.set('needsInitialization', false)
}

const revAfter = (doc: Y.Doc, sectionId: string): string | undefined =>
  findSection(liveDocJson(doc), sectionId)?.rev

/** Changes characters inside one text run, so it can never reach a block, a picture or a heading. */
const applyText = (doc: Y.Doc, section: Section, target: SectionTarget): DocApplyResult => {
  const { oldText = '', newText = '' } = target
  if (oldText === newText) return invalid('new_text is the same')
  const body = doc.getXmlFragment('default').slice(section.start, section.end) as BodyNode[]
  const runs = textRunsOf(body)
  const match = findUniqueText(runs.map(plainText), oldText)
  if (!match.ok) {
    return invalid(
      match.count === 0 ? 'it is not in this section' : `it is in this section ${match.count} times`
    )
  }

  const run = runs[match.run]
  const { head, tail } = trimShared(oldText, newText)
  const at = match.offset + head
  const removed = oldText.length - head - tail
  const inserted = newText.slice(head, newText.length - tail)
  if (removed > 0 && removesMediaLink(run, at, removed)) {
    return invalid('it covers a file link, and docs.plus never deletes media for an AI app')
  }
  // A replacement keeps the marks of the first character it replaces.
  const attributes = removed > 0 ? attributesAt(run, at) : caretAttributes(run, at)
  doc.transact(() => {
    if (removed > 0) run.delete(at, removed)
    if (inserted) run.insert(at, inserted, attributes)
    markApplied(doc)
  }, CONTENT_APPLY_ORIGIN)
  return { ok: true, rev: revAfter(doc, target.sectionId) }
}

/**
 * Only `isDraft` and `needsInitialization` are touched. `store()` refuses to
 * persist a draft, and the empty-title-heading recipe would otherwise be
 * overwritten by the webapp's starter template on first open.
 */
export const applyContentToDoc = (
  doc: Y.Doc,
  scratch: Y.Doc,
  mode: ApplyMode,
  target?: SectionTarget
): DocApplyResult => {
  const fragment = doc.getXmlFragment('default')

  let section: Section | null = null
  if (mode === 'blocks' || mode === 'text') {
    if (!target) return invalid('section target missing')
    const located = locateSection(doc, target)
    if ('ok' in located) return located
    section = located
    if (mode === 'text') return applyText(doc, section, target)
  }

  // Clone before any mutation, not incidentally. `clone()` recurses, so a throw
  // on pathological input has to land while the live fragment is still whole.
  // Delete-first would broadcast a half-wipe to every collaborator. The cast
  // drops YXmlHook, which insert() rejects and the transformer never produces.
  const source = scratch.getXmlFragment('default').toArray() as BodyNode[]
  const nodes = source.map((node) => node.clone()) as BodyNode[]

  let span = { start: fragment.length, end: fragment.length }
  if (mode === 'replace') span = { start: 0, end: fragment.length }
  if (section && target) {
    const located = blockSpan(section, source, target)
    if ('ok' in located) return located
    span = located
  }

  doc.transact(() => {
    if (span.end > span.start) fragment.delete(span.start, span.end - span.start)
    if (nodes.length > 0) fragment.insert(span.start, nodes)
    markApplied(doc)
  }, CONTENT_APPLY_ORIGIN)
  return { ok: true }
}
