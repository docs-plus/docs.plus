import type * as Y from 'yjs'

import { isRecord } from '../../../lib/isRecord'
import type { DocEdit } from '../types'
import { CONTENT_APPLY_ORIGIN } from '../types'
import { isMediaHref } from './media'
import { liveDocJson } from './readContent'
import { findSection, type Section } from './sections'
import { findUniqueText, INLINE_NODE_CHAR } from './textRuns'

type EditOf<Mode extends DocEdit['mode']> = Extract<DocEdit, { mode: Mode }>

type DocApplyRefusal = { ok: false; status: 'conflict' | 'invalid-content'; detail: string }

/** `rev` is the section's rev after a text edit; every other edit renumbers blocks, so it has none. */
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
const locateSection = (
  doc: Y.Doc,
  target: { sectionId: string; rev: string }
): Section | DocApplyRefusal => {
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

/**
 * The flat schema: a heading owns every later block up to the next heading. One above the
 * floor re-parents the subsections after it. Read the source nodes, not clones: a clone holds
 * its attributes as pending values.
 */
const headingRefusal = (section: Section, source: BodyNode[]): DocApplyRefusal | null => {
  const levels = source.map(sourceHeadingLevel).filter((level) => level !== null)
  return levels.some((level) => level < section.minHeadingLevel)
    ? invalid(`a new heading must be at level ${section.minHeadingLevel} or deeper`)
    : null
}

/** Where `blocks` puts the new nodes, or why it cannot. */
const blockSpan = (
  section: Section,
  source: BodyNode[],
  { from, to }: EditOf<'blocks'>
): { start: number; end: number } | DocApplyRefusal => {
  const blocks = section.end - section.start
  if (from > to || to > blocks) {
    return invalid(`the block range is outside this section, which has ${blocks} block(s)`)
  }
  if (from === to && source.length === 0) return invalid('nothing to insert or delete')
  const refusal = headingRefusal(section, source)
  if (refusal) return refusal
  // One before the end of the body would move the blocks behind it into a new subsection.
  if (source.some((node) => sourceHeadingLevel(node) !== null) && to !== blocks) {
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

/**
 * Moves one live block, never re-encoded, so it keeps every attribute and its caption.
 * The body holds no heading, so a move never crosses one.
 */
const applyMove = (doc: Y.Doc, section: Section, { from, to }: EditOf<'move'>): DocApplyResult => {
  const blocks = section.end - section.start
  if (from >= blocks || to > blocks) {
    return invalid(`the block or the caret is outside this section, which has ${blocks} block(s)`)
  }
  if (to === from || to === from + 1) return invalid('the block is already there')

  const fragment = doc.getXmlFragment('default')
  // Cloned before the delete: a deleted node clones empty, and nothing throws.
  const moved = (fragment.get(section.start + from) as BodyNode).clone()
  // The caret is counted before the delete, so a caret after the block shifts back by one.
  const at = section.start + (to > from ? to - 1 : to)
  doc.transact(() => {
    fragment.delete(section.start + from, 1)
    fragment.insert(at, [moved])
    markApplied(doc)
  }, CONTENT_APPLY_ORIGIN)
  return { ok: true }
}

/**
 * The new nodes with each kept live block cloned in at its place. A kept block may not
 * follow a new heading: that would move it out of this section.
 */
const withKeptBlocks = (
  body: BodyNode[],
  source: BodyNode[],
  nodes: BodyNode[],
  keep: EditOf<'rewrite'>['keep']
): BodyNode[] | DocApplyRefusal => {
  const firstHeading = source.findIndex((node) => sourceHeadingLevel(node) !== null)
  const lastAt = firstHeading === -1 ? nodes.length : firstHeading
  const seen = new Set<number>()
  let previous = 0
  for (const { block, at } of keep) {
    // The agent counts blocks from 1, so the refusal does too.
    if (block >= body.length || seen.has(block)) {
      return invalid(`kept block ${block + 1} is not a single block of this section`)
    }
    if (at < previous || at > lastAt) {
      return invalid(`kept block ${block + 1} must stand in order, before any new heading`)
    }
    seen.add(block)
    previous = at
  }

  const merged: BodyNode[] = []
  let next = 0
  for (const { block, at } of keep) {
    merged.push(...nodes.slice(next, at), body[block].clone())
    next = at
  }
  return [...merged, ...nodes.slice(next)]
}

const markApplied = (doc: Y.Doc): void => {
  const metadata = doc.getMap('metadata')
  metadata.set('isDraft', false)
  metadata.set('needsInitialization', false)
}

const revAfter = (doc: Y.Doc, sectionId: string): string | undefined =>
  findSection(liveDocJson(doc), sectionId)?.rev

/** Changes characters inside one text run, so it can never reach a block, a picture or a heading. */
const applyText = (doc: Y.Doc, section: Section, edit: EditOf<'text'>): DocApplyResult => {
  const { oldText, newText } = edit
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
  return { ok: true, rev: revAfter(doc, edit.sectionId) }
}

// The cast drops YXmlHook, which insert() rejects and the transformer never produces.
const sourceNodes = (scratch: Y.Doc): BodyNode[] =>
  scratch.getXmlFragment('default').toArray() as BodyNode[]

// Clone before any mutation, not incidentally. `clone()` recurses, so a throw
// on pathological input has to land while the live fragment is still whole.
// Delete-first would broadcast a half-wipe to every collaborator.
const cloneAll = (source: BodyNode[]): BodyNode[] => source.map((node) => node.clone())

const spliceNodes = (
  doc: Y.Doc,
  span: { start: number; end: number },
  nodes: BodyNode[]
): DocApplyResult => {
  const fragment = doc.getXmlFragment('default')
  doc.transact(() => {
    if (span.end > span.start) fragment.delete(span.start, span.end - span.start)
    if (nodes.length > 0) fragment.insert(span.start, nodes)
    markApplied(doc)
  }, CONTENT_APPLY_ORIGIN)
  return { ok: true }
}

/**
 * Rebuilds the whole body from the new nodes, with each kept live block cloned in before
 * the delete: a deleted Yjs node clones empty, and nothing throws.
 */
const applyRewrite = (
  doc: Y.Doc,
  section: Section,
  scratch: Y.Doc,
  { keep }: EditOf<'rewrite'>
): DocApplyResult => {
  const source = sourceNodes(scratch)
  const refusal = headingRefusal(section, source)
  if (refusal) return refusal
  const body = doc.getXmlFragment('default').slice(section.start, section.end) as BodyNode[]
  const nodes = withKeptBlocks(body, source, cloneAll(source), keep)
  if ('ok' in nodes) return nodes
  return spliceNodes(doc, { start: section.start, end: section.end }, nodes)
}

/**
 * Only `isDraft` and `needsInitialization` are touched. `store()` refuses to
 * persist a draft, and the empty-title-heading recipe would otherwise be
 * overwritten by the webapp's starter template on first open.
 */
export const applyContentToDoc = (doc: Y.Doc, scratch: Y.Doc, edit: DocEdit): DocApplyResult => {
  const length = doc.getXmlFragment('default').length
  if (edit.mode === 'replace') {
    return spliceNodes(doc, { start: 0, end: length }, cloneAll(sourceNodes(scratch)))
  }
  if (edit.mode === 'append') {
    return spliceNodes(doc, { start: length, end: length }, cloneAll(sourceNodes(scratch)))
  }

  const section = locateSection(doc, edit)
  if ('ok' in section) return section
  switch (edit.mode) {
    case 'text':
      return applyText(doc, section, edit)
    case 'move':
      return applyMove(doc, section, edit)
    case 'rewrite':
      return applyRewrite(doc, section, scratch, edit)
    case 'blocks': {
      const source = sourceNodes(scratch)
      const span = blockSpan(section, source, edit)
      if ('ok' in span) return span
      return spliceNodes(doc, span, cloneAll(source))
    }
    default: {
      const unhandled: never = edit
      return unhandled
    }
  }
}
