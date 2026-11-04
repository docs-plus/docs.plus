import { filterSections, findAllSections } from '@components/TipTap/extensions/shared/match-section'
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TIPTAP_NODES } from '@types'
import { headingAncestry } from '@utils/headingSlugTrail'

import type { InternalDocumentLink } from '../types'
import type { CardReply } from './model'

type EditorCardLink = Extract<InternalDocumentLink, { kind: 'heading' | 'filter' }>

const LINES_MAX = 2
const LIST_TYPES = new Set<string>([
  TIPTAP_NODES.BULLETLIST_TYPE,
  TIPTAP_NODES.ORDEREDLIST_TYPE,
  TIPTAP_NODES.TASK_LIST_TYPE
])
const LINE_TYPES = new Set<string>([TIPTAP_NODES.PARAGRAPH_TYPE, TIPTAP_NODES.BLOCKQUOTE_TYPE])

/** The route's rule (`blocksIn` on the server): one line per paragraph, quote or list item. */
const blockLines = (node: PMNode): string[] => {
  if (LIST_TYPES.has(node.type.name)) {
    const lines: string[] = []
    node.forEach((item) => {
      const text = item.firstChild?.textContent.trim()
      if (text) lines.push(text)
    })
    return lines
  }
  if (!LINE_TYPES.has(node.type.name)) return []
  const text = node.textBetween(0, node.content.size, ' ', ' ').trim()
  return text ? [text] : []
}

/** A same-pad heading, read from the open editor. Subsections are the deeper headings after it. */
const headingReply = (editor: Editor, headingId: string, padTitle: string): CardReply | null => {
  const ancestry = headingAncestry(editor, headingId)
  const own = ancestry.at(-1)
  if (!own) return null

  const doc = editor.state.doc
  let start = 0
  while (start < doc.childCount && doc.child(start).attrs['toc-id'] !== headingId) start++

  let subsections = 0
  const lines: string[] = []
  for (let i = start + 1; i < doc.childCount; i++) {
    const child = doc.child(i)
    if (child.type.name === TIPTAP_NODES.HEADING_TYPE) {
      if ((child.attrs.level as number) <= own.level) break
      subsections++
    } else if (subsections === 0 && lines.length < LINES_MAX) {
      lines.push(...blockLines(child))
    }
  }

  return {
    kind: 'heading',
    padTitle,
    title: own.text,
    trail: ancestry
      .slice(1, -1)
      .map((heading) => heading.text)
      .filter(Boolean),
    subsections,
    lines: lines.slice(0, LINES_MAX),
    messages: null
  }
}

/** The same section rule as the filter engine, so the card agrees with the filtered pad. */
const filterReply = (
  doc: PMNode,
  link: Extract<InternalDocumentLink, { kind: 'filter' }>,
  padTitle: string
): CardReply => {
  const sections = findAllSections(doc)
  const { matchedIds, totalSections } = filterSections(doc, link.terms, link.mode)
  const shown = sections
    .filter((section) => matchedIds.has(section.id))
    .map((section) => doc.child(section.childIndex).textContent.trim())
  return {
    kind: 'filter',
    padTitle,
    terms: link.terms,
    mode: link.mode,
    shown,
    shownCount: shown.length,
    total: totalSections
  }
}

/** Heading and filter cards for this pad need no request. `null` is a heading the pad no longer has. */
export const editorCardReply = (
  editor: Editor,
  link: EditorCardLink,
  padTitle: string
): CardReply | null =>
  link.kind === 'heading'
    ? headingReply(editor, link.headingId, padTitle)
    : filterReply(editor.state.doc, link, padTitle)
