import type * as Y from 'yjs'

import type { ApplyMode } from '../types'
import { CONTENT_APPLY_ORIGIN } from '../types'
import { liveDocJson } from './readContent'
import { findSectionBody, sectionRev } from './sections'

export interface SectionTarget {
  sectionId: string
  rev: string
}

export type DocApplyResult =
  { ok: true } | { ok: false; status: 'conflict' | 'invalid-content'; detail: string }

type BodyNode = Y.XmlElement | Y.XmlText

// Duck-typed, not instanceof: the transformer may resolve its own copy of yjs.
const sourceHeadingLevel = (node: BodyNode): number | null =>
  'nodeName' in node && node.nodeName === 'heading' ? Number(node.getAttribute('level')) : null

/** Where the new nodes go, decided on the live fragment before anything mutates. */
const locateSection = (
  doc: Y.Doc,
  source: Y.XmlFragment,
  target: SectionTarget
): { ok: true; start: number; end: number } | Exclude<DocApplyResult, { ok: true }> => {
  const json = liveDocJson(doc)
  const rev = sectionRev(json, target.sectionId)
  if (rev === null) return { ok: false, status: 'conflict', detail: 'section not found' }
  if (rev !== target.rev) return { ok: false, status: 'conflict', detail: 'section changed' }

  // One JSON entry per fragment item, so the indices carry over. A mismatch
  // means the mapping broke, and a splice would land on the wrong nodes.
  if ((json.content ?? []).length !== doc.getXmlFragment('default').length) {
    return { ok: false, status: 'conflict', detail: 'section could not be addressed' }
  }

  const section = findSectionBody(json, target.sectionId)
  if (!section) return { ok: false, status: 'conflict', detail: 'section not found' }

  // A heading at or above the target would re-parent the subsections after it.
  // Read from the source nodes: a clone holds its attributes as pending values.
  for (const node of source.toArray() as BodyNode[]) {
    const level = sourceHeadingLevel(node)
    if (level !== null && level <= section.level) {
      return {
        ok: false,
        status: 'invalid-content',
        detail: `a replacing heading must be deeper than level ${section.level}`
      }
    }
  }
  return { ok: true, start: section.start, end: section.end }
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
  const source = scratch.getXmlFragment('default')

  // Clone before any mutation, not incidentally. `clone()` recurses, so a throw
  // on pathological input has to land while the live fragment is still whole.
  // Delete-first would broadcast a half-wipe to every collaborator. The cast
  // drops YXmlHook, which insert() rejects and the transformer never produces.
  const nodes = source.toArray().map((node) => node.clone()) as BodyNode[]

  let span = { start: fragment.length, end: fragment.length }
  if (mode === 'section') {
    if (!target) return { ok: false, status: 'invalid-content', detail: 'section target missing' }
    const located = locateSection(doc, source, target)
    if (!located.ok) return located
    span = located
  } else if (mode === 'replace') {
    span = { start: 0, end: fragment.length }
  }

  doc.transact(() => {
    if (span.end > span.start) fragment.delete(span.start, span.end - span.start)
    fragment.insert(span.start, nodes)
    const metadata = doc.getMap('metadata')
    metadata.set('isDraft', false)
    metadata.set('needsInitialization', false)
  }, CONTENT_APPLY_ORIGIN)
  return { ok: true }
}
