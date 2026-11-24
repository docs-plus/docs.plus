import { isRecord } from '../../../lib/isRecord'
import type { ImportResult, TiptapDocJson } from '../types'
import { getParseSchema } from './conversionSchema'
import { ensureTitleHeading, titleHeadingText, titleHeadingWarning } from './ensureTitleHeading'
import { getMarkdownManager } from './markdownExport'
import { promoteImportedMedia } from './promoteImportedMedia'

export const MAX_MARKDOWN_NESTING = 32

export class MarkdownTooDeepError extends Error {
  constructor(readonly depth: number) {
    super(`Markdown nests deeper than ${MAX_MARKDOWN_NESTING} levels`)
    this.name = 'MarkdownTooDeepError'
  }
}

interface FenceState {
  char: number
  length: number
  openIndent: number
  inList: boolean
}

const isSpaceOrTab = (ch: number): boolean => ch === 32 || ch === 9

const countFenceRun = (markdown: string, start: number, end: number, char: number): number => {
  let i = start
  while (i < end && markdown.charCodeAt(i) === char) i += 1
  return i - start
}

const isOnlySpacesOrTabs = (markdown: string, start: number, end: number): boolean => {
  for (let i = start; i < end; i += 1) {
    if (!isSpaceOrTab(markdown.charCodeAt(i))) return false
  }
  return true
}

const hasCharInRange = (markdown: string, target: number, start: number, end: number): boolean => {
  for (let i = start; i < end; i += 1) {
    if (markdown.charCodeAt(i) === target) return true
  }
  return false
}

const isTableDelimiter = (markdown: string, start: number, end: number): boolean => {
  let hasPipe = false
  let hasDash = false
  for (let i = start; i < end; i += 1) {
    const ch = markdown.charCodeAt(i)
    if (ch === 124 /* | */) hasPipe = true
    else if (ch === 45 /* - */) hasDash = true
    else if (ch !== 58 /* : */ && !isSpaceOrTab(ch)) return false
  }
  return hasPipe && hasDash
}

const matchListMarkerEnd = (markdown: string, pos: number, end: number): number => {
  if (pos >= end) return -1
  const ch = markdown.charCodeAt(pos)
  if (ch === 45 /* - */ || ch === 42 /* * */ || ch === 43 /* + */) {
    return pos + 1 === end || isSpaceOrTab(markdown.charCodeAt(pos + 1)) ? pos + 1 : -1
  }
  if (ch >= 48 && ch <= 57) {
    let k = pos
    while (k < end && k - pos < 9) {
      const d = markdown.charCodeAt(k)
      if (d < 48 || d > 57) break
      k += 1
    }
    if (
      k < end &&
      (markdown.charCodeAt(k) === 46 /* . */ || markdown.charCodeAt(k) === 41) /* ) */
    ) {
      return k + 1 === end || isSpaceOrTab(markdown.charCodeAt(k + 1)) ? k + 1 : -1
    }
  }
  return -1
}

const closingIndentForFence = (
  markdown: string,
  lineStart: number,
  contentStart: number,
  colIndent: number,
  fence: FenceState
): number => {
  if (!fence.inList) return colIndent
  let stripped = 0
  let pos = lineStart
  while (pos < contentStart && stripped < fence.openIndent) {
    if (markdown.charCodeAt(pos) === 32) {
      stripped += 1
    } else {
      const step = 4 - (stripped % 4)
      stripped += step
      if (stripped > fence.openIndent) {
        pos += 1
        break
      }
    }
    pos += 1
  }
  let rem = Math.max(0, stripped - fence.openIndent)
  while (pos < contentStart) {
    rem += markdown.charCodeAt(pos) === 9 ? 4 - (rem % 4) : 1
    pos += 1
  }
  return rem
}

/**
 * Single-pass O(n) fence-aware nesting scanner. Rejects deep blockquotes,
 * lists, and indentation above `MAX_MARKDOWN_NESTING` before `marked` runs,
 * while exempting markers inside fenced code blocks.
 */
const assertMarkdownNesting = (markdown: string): void => {
  let fence: FenceState | null = null
  let inList = false
  let listContentIndent = 0
  let sawBlankSinceList = false
  let prevLineHasPipe = false
  let inTable = false

  for (let lineStart = 0; lineStart < markdown.length;) {
    let lineEnd = lineStart
    while (lineEnd < markdown.length) {
      const ch = markdown.charCodeAt(lineEnd)
      if (ch === 10 || ch === 13) break
      lineEnd += 1
    }
    const nextStart =
      lineEnd +
      (markdown.charCodeAt(lineEnd) === 13 && markdown.charCodeAt(lineEnd + 1) === 10 ? 2 : 1)

    let contentStart = lineStart
    let colIndent = 0
    while (contentStart < lineEnd) {
      const ch = markdown.charCodeAt(contentStart)
      if (ch === 32) colIndent += 1
      else if (ch === 9) colIndent += 4 - (colIndent % 4)
      else break
      contentStart += 1
    }

    if (fence !== null) {
      const remIndent = closingIndentForFence(markdown, lineStart, contentStart, colIndent, fence)
      const closeLen = countFenceRun(markdown, contentStart, lineEnd, fence.char)
      if (
        remIndent <= 3 &&
        closeLen >= fence.length &&
        isOnlySpacesOrTabs(markdown, contentStart + closeLen, lineEnd)
      ) {
        fence = null
        inTable = false
        prevLineHasPipe = false
      }
      lineStart = nextStart
      continue
    }

    if (contentStart === lineEnd) {
      inTable = false
      prevLineHasPipe = false
      if (inList) sawBlankSinceList = true
      lineStart = nextStart
      continue
    }

    if (!inTable && prevLineHasPipe && isTableDelimiter(markdown, contentStart, lineEnd)) {
      inTable = true
    }

    const listActiveHere: boolean = inList && !(sawBlankSinceList && colIndent < listContentIndent)
    const maxFenceIndent = listActiveHere ? listContentIndent + 3 : 3
    const firstChar = markdown.charCodeAt(contentStart)
    if (!inTable && colIndent <= maxFenceIndent && (firstChar === 96 || firstChar === 126)) {
      const fenceLen = countFenceRun(markdown, contentStart, lineEnd, firstChar)
      if (
        fenceLen >= 3 &&
        (firstChar === 126 || !hasCharInRange(markdown, 96, contentStart + fenceLen, lineEnd))
      ) {
        fence = {
          char: firstChar,
          length: fenceLen,
          openIndent: colIndent,
          inList: listActiveHere
        }
        inList = listActiveHere
        sawBlankSinceList = false
        prevLineHasPipe = false
        lineStart = nextStart
        continue
      }
    }

    prevLineHasPipe = hasCharInRange(markdown, 124, contentStart, lineEnd)

    if (colIndent <= 3) {
      const markerEnd = matchListMarkerEnd(markdown, contentStart, lineEnd)
      if (markerEnd !== -1) {
        inList = true
        listContentIndent = colIndent + (markerEnd - contentStart) + 1
        sawBlankSinceList = false
      } else if (sawBlankSinceList && colIndent < listContentIndent) {
        inList = false
        listContentIndent = 0
        sawBlankSinceList = false
      }
    }

    let depth = Math.floor(colIndent / 2)
    let pos = contentStart
    if (pos < lineEnd && markdown.charCodeAt(pos) === 60 /* < */) {
      let close = pos + 1
      while (close < lineEnd && markdown.charCodeAt(close) !== 62 /* > */) close += 1
      if (close < lineEnd) pos = close + 1
    }
    while (pos < lineEnd) {
      while (pos < lineEnd && isSpaceOrTab(markdown.charCodeAt(pos))) pos += 1
      if (pos >= lineEnd) break
      if (markdown.charCodeAt(pos) === 62 /* > */) {
        depth += 1
        pos += 1
      } else {
        const markerEnd = matchListMarkerEnd(markdown, pos, lineEnd)
        if (markerEnd === -1) break
        depth += 1
        pos = markerEnd
      }
      if (depth > MAX_MARKDOWN_NESTING) throw new MarkdownTooDeepError(depth)
    }
    if (depth > MAX_MARKDOWN_NESTING) throw new MarkdownTooDeepError(depth)

    lineStart = nextStart
  }
}

/**
 * `marked` drops a lone image straight into a block container, but `image` is
 * inline, so `PATCH /content` answers "Invalid content for node doc" and the two
 * documented routes stop composing. The DOCX lane gets this free from
 * ProseMirror's DOMParser; Markdown reaches Tiptap JSON with no parse step.
 */
export const wrapStrayInlineNodes = (doc: TiptapDocJson): TiptapDocJson => {
  const schema = getParseSchema()
  const rootContent: Record<string, unknown>[] = []
  const docType = typeof doc.type === 'string' ? schema.nodes[doc.type] : undefined
  const stack: {
    source: unknown[]
    target: Record<string, unknown>[]
    parentType: typeof docType
  }[] = [
    {
      source: Array.isArray(doc.content) ? doc.content : [],
      target: rootContent,
      parentType: docType
    }
  ]

  while (stack.length > 0) {
    const frame = stack.pop()!
    for (const child of frame.source) {
      if (!isRecord(child)) continue
      const childType = typeof child.type === 'string' ? schema.nodes[child.type] : undefined
      let walked: Record<string, unknown> = child
      if (Array.isArray(child.content)) {
        const next: Record<string, unknown>[] = []
        stack.push({ source: child.content, target: next, parentType: childType })
        walked = { ...child, content: next }
      }
      frame.target.push(
        childType?.isInline && frame.parentType && !frame.parentType.inlineContent
          ? { type: 'paragraph', content: [walked] }
          : walked
      )
    }
  }

  return { ...doc, content: rootContent }
}

/**
 * Parses through the export path's manager — a second one mutates the global
 * `marked` singleton. Callers gate on `MAX_MARKDOWN_CHARS` first: `marked`
 * parses in quadratic time and blocks the event loop. No title rule: a
 * fragment written into an existing document must not gain a title.
 */
export const parseMarkdown = (markdown: string): TiptapDocJson => {
  assertMarkdownNesting(markdown)
  let parsed: TiptapDocJson
  try {
    parsed = getMarkdownManager().parse(markdown) as unknown as TiptapDocJson
  } catch (error) {
    if (error instanceof RangeError) {
      throw new MarkdownTooDeepError(MAX_MARKDOWN_NESTING + 1)
    }
    throw error
  }
  return promoteImportedMedia(wrapStrayInlineNodes(parsed))
}

export const importMarkdown = (markdown: string, fallbackTitle: string): ImportResult => {
  const { doc, branch } = ensureTitleHeading(parseMarkdown(markdown), fallbackTitle)
  const title = titleHeadingText(doc) || fallbackTitle.trim()
  const warning = titleHeadingWarning(branch, title)

  return { content: doc, title, warnings: warning ? [warning] : [] }
}
