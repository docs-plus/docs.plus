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

interface OpenFence {
  char: '`' | '~'
  length: number
  openIndent: number
  couldBeInList: boolean
  couldBeInTaskList: boolean
  couldBeInOrderedList: boolean
  listMaxStrip: number
  taskMaxStrip: number
  orderedMaxStrip: number
}

type HtmlEnd =
  | { kind: 'none' }
  | { kind: 'endTag'; tag: string }
  | { kind: 'substr'; needle: string }
  | { kind: 'blank' }

type DefState =
  | { kind: 'none' }
  | { kind: 'label' }
  | { kind: 'urlNext' }
  | { kind: 'titleMaybe' }
  | { kind: 'title'; closeChar: number; escapable: boolean }

interface LineLeading {
  asciiSpaceIndent: number
  asciiSpaceAt: number
  colIndent: number
  tabStopIndent: number
  asciiWsAt: number
  rawJsWsCount: number
  jsWsAt: number
  asciiBlank: boolean
  jsBlank: boolean
}

const MAX_FENCE_HYPOTHESES = 4

const HTML_BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hr',
  'html',
  'iframe',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'meta',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'search',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'track',
  'ul'
])

const isRawHtmlPrefix = (tagName: string): boolean =>
  tagName.startsWith('script') ||
  tagName.startsWith('pre') ||
  tagName.startsWith('style') ||
  tagName.startsWith('textarea')

const findSubstrInRange = (
  markdown: string,
  needle: string,
  start: number,
  end: number
): number => {
  const len = needle.length
  const limit = end - len
  if (limit < start) return -1
  const first = needle.charCodeAt(0)
  for (let i = start; i <= limit; i += 1) {
    if (markdown.charCodeAt(i) !== first) continue
    let match = true
    for (let j = 1; j < len; j += 1) {
      if (markdown.charCodeAt(i + j) !== needle.charCodeAt(j)) {
        match = false
        break
      }
    }
    if (match) return i
  }
  return -1
}

const hasCaseInsensitiveTagClose = (
  markdown: string,
  tag: string,
  start: number,
  end: number
): boolean => {
  const tagLen = tag.length
  const limit = end - (tagLen + 3)
  for (let i = start; i <= limit; i += 1) {
    if (
      markdown.charCodeAt(i) !== 60 /* < */ ||
      markdown.charCodeAt(i + 1) !== 47 /* / */ ||
      markdown.charCodeAt(i + 2 + tagLen) !== 62 /* > */
    ) {
      continue
    }
    let match = true
    for (let j = 0; j < tagLen; j += 1) {
      let ch = markdown.charCodeAt(i + 2 + j)
      if (ch >= 65 && ch <= 90) ch += 32
      if (ch !== tag.charCodeAt(j)) {
        match = false
        break
      }
    }
    if (match) return true
  }
  return false
}

const isHorizontalJsWhitespace = (ch: number): boolean =>
  ch === 32 ||
  ch === 9 ||
  ch === 11 ||
  ch === 12 ||
  ch === 0x00a0 ||
  ch === 0x1680 ||
  (ch >= 0x2000 && ch <= 0x200a) ||
  ch === 0x2028 ||
  ch === 0x2029 ||
  ch === 0x202f ||
  ch === 0x205f ||
  ch === 0x3000 ||
  ch === 0xfeff

const isAsciiSpaceOnly = (markdown: string, start: number, end: number): boolean => {
  for (let i = start; i < end; i += 1) {
    if (markdown.charCodeAt(i) !== 32) return false
  }
  return true
}

const isAsciiBlank = (markdown: string, start: number, end: number): boolean => {
  for (let i = start; i < end; i += 1) {
    const ch = markdown.charCodeAt(i)
    if (ch !== 32 && ch !== 9) return false
  }
  return true
}

const measureLineLeading = (markdown: string, start: number, end: number): LineLeading => {
  let asciiSpaceIndent = 0
  let asciiSpaceAt = start
  while (asciiSpaceAt < end && markdown.charCodeAt(asciiSpaceAt) === 32) {
    asciiSpaceIndent += 1
    asciiSpaceAt += 1
  }

  let colIndent = asciiSpaceIndent
  let tabStopIndent = asciiSpaceIndent
  let asciiWsAt = asciiSpaceAt
  while (asciiWsAt < end) {
    const ch = markdown.charCodeAt(asciiWsAt)
    if (ch === 32) {
      colIndent += 1
      tabStopIndent += 1
      asciiWsAt += 1
    } else if (ch === 9) {
      colIndent += 4
      tabStopIndent += 4 - (tabStopIndent % 4)
      asciiWsAt += 1
    } else {
      break
    }
  }

  let rawJsWsCount = asciiWsAt - start
  let jsWsAt = asciiWsAt
  while (jsWsAt < end && isHorizontalJsWhitespace(markdown.charCodeAt(jsWsAt))) {
    rawJsWsCount += 1
    jsWsAt += 1
  }

  return {
    asciiSpaceIndent,
    asciiSpaceAt,
    colIndent,
    tabStopIndent,
    asciiWsAt,
    rawJsWsCount,
    jsWsAt,
    asciiBlank: asciiWsAt === end,
    jsBlank: jsWsAt === end
  }
}

const measureDepthIndent = (
  markdown: string,
  start: number,
  end: number
): { indent: number; at: number } => {
  let indent = 0
  let at = start
  while (at < end) {
    const ch = markdown.charCodeAt(at)
    if (ch === 32) {
      indent += 1
      at += 1
    } else if (ch === 9) {
      indent += 4
      at += 1
    } else if (isHorizontalJsWhitespace(ch)) {
      indent += 1
      at += 1
    } else {
      break
    }
  }
  return { indent, at }
}

const isRomanChar = (ch: number): boolean =>
  ch === 73 ||
  ch === 86 ||
  ch === 88 ||
  ch === 76 ||
  ch === 67 ||
  ch === 68 ||
  ch === 77 ||
  ch === 105 ||
  ch === 118 ||
  ch === 120 ||
  ch === 108 ||
  ch === 99 ||
  ch === 100 ||
  ch === 109

const isAsciiLetter = (ch: number): boolean => (ch >= 65 && ch <= 90) || (ch >= 97 && ch <= 122)

const isAsciiDigit = (ch: number): boolean => ch >= 48 && ch <= 57

const matchOrderedListMarker = (markdown: string, at: number, end: number): number => {
  if (at >= end) return 0
  const first = markdown.charCodeAt(at)
  let cursor = at

  if (isAsciiDigit(first)) {
    cursor += 1
    while (cursor < end && isAsciiDigit(markdown.charCodeAt(cursor))) cursor += 1
  } else if (isAsciiLetter(first)) {
    let allRoman = isRomanChar(first)
    cursor += 1
    while (cursor < end && isAsciiLetter(markdown.charCodeAt(cursor))) {
      const ch = markdown.charCodeAt(cursor)
      if (!isRomanChar(ch)) allRoman = false
      cursor += 1
    }
    const len = cursor - at
    if (!allRoman && len > 2) return 0
  } else {
    return 0
  }

  if (cursor + 1 >= end) return 0
  const punct = markdown.charCodeAt(cursor)
  if (punct !== 46 && punct !== 41) return 0
  if (!isHorizontalJsWhitespace(markdown.charCodeAt(cursor + 1))) return 0
  return cursor - at
}

const isTaskListMarkerAt = (markdown: string, at: number, end: number): boolean => {
  if (at >= end) return false
  const bullet = markdown.charCodeAt(at)
  if (bullet !== 45 && bullet !== 42 && bullet !== 43) return false

  let cursor = at + 1
  while (cursor < end && isHorizontalJsWhitespace(markdown.charCodeAt(cursor))) cursor += 1
  if (cursor === at + 1 || cursor + 3 >= end) return false
  if (markdown.charCodeAt(cursor) !== 91 /* [ */) return false
  const check = markdown.charCodeAt(cursor + 1)
  if (check !== 32 && check !== 120 && check !== 88) return false
  if (markdown.charCodeAt(cursor + 2) !== 93 /* ] */) return false
  return isHorizontalJsWhitespace(markdown.charCodeAt(cursor + 3))
}

const isThematicBreak = (markdown: string, at: number, end: number, allowTab: boolean): boolean => {
  if (at >= end) return false
  const marker = markdown.charCodeAt(at)
  if (marker !== 45 && marker !== 95 && marker !== 42) return false
  let count = 0
  for (let i = at; i < end; i += 1) {
    const ch = markdown.charCodeAt(i)
    if (ch === marker) {
      count += 1
    } else if (ch !== 32 && !(allowTab && ch === 9)) {
      return false
    }
  }
  return count >= 3
}

const isListInterruptorAtZero = (
  markdown: string,
  leading: LineLeading,
  end: number,
  listMaxStrip: number
): { stopsMarkedList: boolean; stopsOrderedList: boolean } => {
  const at = leading.asciiSpaceAt
  if (leading.asciiSpaceIndent > 3 || at >= end) {
    return { stopsMarkedList: false, stopsOrderedList: false }
  }
  const ch = markdown.charCodeAt(at)
  const markedCanInterrupt =
    listMaxStrip > 0 && leading.asciiSpaceIndent <= Math.min(3, listMaxStrip - 1)
  const orderedCanInterrupt = leading.asciiSpaceIndent === 0

  if (ch === 35 /* # */) {
    let hashEnd = at + 1
    while (hashEnd < end && markdown.charCodeAt(hashEnd) === 35) hashEnd += 1
    if (
      hashEnd - at <= 6 &&
      (hashEnd === end || isHorizontalJsWhitespace(markdown.charCodeAt(hashEnd)))
    ) {
      return { stopsMarkedList: markedCanInterrupt, stopsOrderedList: orderedCanInterrupt }
    }
  }

  if (ch === 62 /* > */) {
    return { stopsMarkedList: markedCanInterrupt, stopsOrderedList: false }
  }

  if (isThematicBreak(markdown, at, end, false)) {
    return { stopsMarkedList: markedCanInterrupt, stopsOrderedList: orderedCanInterrupt }
  }
  if (orderedCanInterrupt && isThematicBreak(markdown, at, end, true)) {
    return { stopsMarkedList: false, stopsOrderedList: true }
  }

  if (orderedCanInterrupt) {
    if (
      (ch === 96 && markdown.startsWith('```', at)) ||
      (ch === 126 && markdown.startsWith('~~~', at)) ||
      (ch === 36 && markdown.startsWith('$$', at))
    ) {
      return { stopsMarkedList: markedCanInterrupt && ch !== 36, stopsOrderedList: true }
    }
    if (
      (ch === 45 || ch === 42 || ch === 43) &&
      at + 1 < end &&
      isHorizontalJsWhitespace(markdown.charCodeAt(at + 1))
    ) {
      return { stopsMarkedList: false, stopsOrderedList: true }
    }
  }

  if (markedCanInterrupt) {
    if (
      (ch === 96 && markdown.startsWith('```', at)) ||
      (ch === 126 && markdown.startsWith('~~~', at))
    ) {
      return { stopsMarkedList: true, stopsOrderedList: orderedCanInterrupt }
    }
    if (ch === 60 /* < */ && at + 1 < end) {
      if (
        at + 4 <= end &&
        markdown.charCodeAt(at + 1) === 33 &&
        markdown.charCodeAt(at + 2) === 45 &&
        markdown.charCodeAt(at + 3) === 45
      ) {
        return { stopsMarkedList: true, stopsOrderedList: false }
      }
      if (
        isAsciiLetter(markdown.charCodeAt(at + 1)) &&
        findSubstrInRange(markdown, '>', at + 2, end) !== -1
      ) {
        return { stopsMarkedList: true, stopsOrderedList: false }
      }
    }
  }

  return { stopsMarkedList: false, stopsOrderedList: false }
}

const isSetextUnderline = (markdown: string, at: number, lineEnd: number): boolean => {
  if (at >= lineEnd) return false
  const marker = markdown.charCodeAt(at)
  if (marker !== 61 /* = */ && marker !== 45 /* - */) return false
  let i = at + 1
  while (i < lineEnd && markdown.charCodeAt(i) === marker) i += 1
  return isAsciiSpaceOnly(markdown, i, lineEnd)
}

const isParagraphTerminator = (
  markdown: string,
  at: number,
  lineEnd: number,
  inParagraph: boolean,
  inTable: boolean
): boolean => {
  if (at >= lineEnd) return false
  const ch = markdown.charCodeAt(at)
  if (ch === 35 /* # */) {
    let hashEnd = at + 1
    while (hashEnd < lineEnd && markdown.charCodeAt(hashEnd) === 35) hashEnd += 1
    if (
      hashEnd - at <= 6 &&
      (hashEnd === lineEnd || isHorizontalJsWhitespace(markdown.charCodeAt(hashEnd)))
    ) {
      return true
    }
  }
  if (isThematicBreak(markdown, at, lineEnd, true)) return true
  if (inParagraph && !inTable && isSetextUnderline(markdown, at, lineEnd)) return true
  if (ch === 62 /* > */) return true
  return false
}

const countRawTableHeaderCells = (markdown: string, at: number, lineEnd: number): number => {
  if (at >= lineEnd) return 0
  let cells = 0
  let firstCell = true
  let cellHasNonWs = false
  let backslashes = 0
  for (let i = at; i < lineEnd; i += 1) {
    const ch = markdown.charCodeAt(i)
    if (ch === 124 /* | */ && backslashes % 2 === 0) {
      if (!firstCell || cellHasNonWs) cells += 1
      firstCell = false
      cellHasNonWs = false
      backslashes = 0
    } else if (ch === 92 /* \ */) {
      backslashes += 1
      cellHasNonWs = true
    } else {
      backslashes = 0
      if (!isHorizontalJsWhitespace(ch)) cellHasNonWs = true
    }
  }
  if (cellHasNonWs) cells += 1
  return cells
}

const analyzeTableHeaderLine = (
  markdown: string,
  at: number,
  lineEnd: number
): { cells: number; maxRawCells: number } => {
  if (at >= lineEnd) return { cells: 0, maxRawCells: 0 }
  let hasBacktick = false
  for (let k = at; k < lineEnd; k += 1) {
    if (markdown.charCodeAt(k) === 96 /* ` */) {
      hasBacktick = true
      break
    }
  }
  const maxRawCells = countRawTableHeaderCells(markdown, at, lineEnd)
  if (!hasBacktick) return { cells: maxRawCells, maxRawCells }

  const runs: { start: number; len: number; escapedFirst: boolean }[] = []
  let bs = 0
  let p = at
  while (p < lineEnd) {
    const ch = markdown.charCodeAt(p)
    if (ch === 96 /* ` */) {
      let runLen = 1
      while (p + runLen < lineEnd && markdown.charCodeAt(p + runLen) === 96) runLen += 1
      runs.push({ start: p, len: runLen, escapedFirst: bs % 2 === 1 })
      bs = 0
      p += runLen
      continue
    }
    bs = ch === 92 ? bs + 1 : 0
    p += 1
  }

  const matchCloserEnd = new Int32Array(runs.length)
  const lastCloserPos = new Map<number, number>()
  for (let r = runs.length - 1; r >= 0; r -= 1) {
    const run = runs[r]!
    const openLen = run.escapedFirst ? run.len - 1 : run.len
    if (openLen > 0) {
      const closerStart = lastCloserPos.get(openLen)
      matchCloserEnd[r] = closerStart !== undefined ? closerStart + openLen : -1
    } else {
      matchCloserEnd[r] = -1
    }
    lastCloserPos.set(run.len, run.start)
  }

  let cells = 0
  let firstCell = true
  let cellHasNonWs = false
  let backslashes = 0
  let runIdx = 0
  let i = at
  while (i < lineEnd) {
    const ch = markdown.charCodeAt(i)
    if (ch === 96 /* ` */ && backslashes % 2 === 0) {
      while (runIdx < runs.length && runs[runIdx]!.start + runs[runIdx]!.len <= i) {
        runIdx += 1
      }
      const run = runs[runIdx]!
      const matchedEnd = matchCloserEnd[runIdx]!
      cellHasNonWs = true
      backslashes = 0
      if (matchedEnd !== -1) {
        i = matchedEnd
      } else {
        i += run.escapedFirst ? run.len - 1 : run.len
      }
      continue
    }
    if (ch === 124 /* | */ && backslashes % 2 === 0) {
      if (!firstCell || cellHasNonWs) cells += 1
      firstCell = false
      cellHasNonWs = false
      backslashes = 0
    } else if (ch === 92 /* \ */) {
      backslashes += 1
      cellHasNonWs = true
    } else {
      backslashes = 0
      if (!isHorizontalJsWhitespace(ch)) cellHasNonWs = true
    }
    i += 1
  }
  if (cellHasNonWs) cells += 1
  return { cells, maxRawCells }
}

const matchesTableSeparatorRegex = (
  markdown: string,
  start: number,
  end: number,
  requirePipeOrColon: boolean
): { cells: number; hasPipe: boolean } => {
  if (start >= end) return { cells: 0, hasPipe: false }
  let i = start
  let spaces = 0
  while (i < end && markdown.charCodeAt(i) === 32 && spaces <= 3) {
    spaces += 1
    i += 1
  }
  if (spaces > 3 || i >= end) return { cells: 0, hasPipe: false }
  let sawPipeOrColon = false
  let hasPipe = false
  if (markdown.charCodeAt(i) === 124 /* | */) {
    sawPipeOrColon = true
    hasPipe = true
    i += 1
    while (i < end && markdown.charCodeAt(i) === 32) i += 1
  }
  const parseCell = (): boolean => {
    if (i < end && markdown.charCodeAt(i) === 58 /* : */) {
      sawPipeOrColon = true
      i += 1
    }
    const dashStart = i
    while (i < end && markdown.charCodeAt(i) === 45 /* - */) i += 1
    if (i === dashStart) return false
    if (i < end && markdown.charCodeAt(i) === 58 /* : */) {
      sawPipeOrColon = true
      i += 1
    }
    while (i < end && markdown.charCodeAt(i) === 32) i += 1
    return true
  }
  let cells = 0
  if (!parseCell()) return { cells: 0, hasPipe: false }
  cells += 1
  while (i < end) {
    if (markdown.charCodeAt(i) !== 124 /* | */) return { cells: 0, hasPipe: false }
    sawPipeOrColon = true
    hasPipe = true
    i += 1
    while (i < end && markdown.charCodeAt(i) === 32) i += 1
    if (i >= end) break
    if (!parseCell()) return { cells: 0, hasPipe: false }
    cells += 1
  }
  return !requirePipeOrColon || sawPipeOrColon ? { cells, hasPipe } : { cells: 0, hasPipe: false }
}

const countTableDelimiterInfo = (
  markdown: string,
  at: number,
  lineEnd: number
): { cells: number; hasPipe: boolean } => matchesTableSeparatorRegex(markdown, at, lineEnd, true)

const matchesMarkedCodeStart = (markdown: string, leading: LineLeading, lineEnd: number): boolean =>
  (leading.asciiSpaceIndent >= 4 && leading.asciiSpaceAt < lineEnd) ||
  (leading.asciiSpaceIndent <= 3 &&
    leading.asciiSpaceAt < lineEnd &&
    markdown.charCodeAt(leading.asciiSpaceAt) === 9 &&
    leading.asciiSpaceAt + 1 < lineEnd)

const stopsMarkedTable = (markdown: string, leading: LineLeading, lineEnd: number): boolean => {
  if (matchesMarkedCodeStart(markdown, leading, lineEnd)) return true
  if (leading.asciiSpaceIndent > 3 || leading.asciiSpaceAt >= lineEnd) return false
  const at = leading.asciiSpaceAt
  const ch = markdown.charCodeAt(at)

  if (ch === 62 /* > */) return true
  if (ch === 35 /* # */) {
    let hashEnd = at + 1
    while (hashEnd < lineEnd && markdown.charCodeAt(hashEnd) === 35) hashEnd += 1
    if (
      hashEnd - at <= 6 &&
      (hashEnd === lineEnd || isHorizontalJsWhitespace(markdown.charCodeAt(hashEnd)))
    ) {
      return true
    }
  }
  if (isThematicBreak(markdown, at, lineEnd, true)) return true
  if ((ch === 96 || ch === 126) && lineEnd < markdown.length) {
    if (matchFenceRunAt(markdown, at, lineEnd) !== null) return true
  }
  if (
    (ch === 45 || ch === 42 || ch === 43) &&
    at + 1 < lineEnd &&
    (markdown.charCodeAt(at + 1) === 32 || markdown.charCodeAt(at + 1) === 9)
  ) {
    return true
  }
  if (
    ch === 49 /* 1 */ &&
    at + 2 < lineEnd &&
    (markdown.charCodeAt(at + 1) === 46 || markdown.charCodeAt(at + 1) === 41) &&
    (markdown.charCodeAt(at + 2) === 32 || markdown.charCodeAt(at + 2) === 9)
  ) {
    return true
  }
  if (ch === 60 /* < */) {
    if (
      at + 4 <= lineEnd &&
      markdown.charCodeAt(at + 1) === 33 &&
      markdown.charCodeAt(at + 2) === 45 &&
      markdown.charCodeAt(at + 3) === 45
    ) {
      return true
    }
    let cursor = at + 1
    const isClose = cursor < lineEnd && markdown.charCodeAt(cursor) === 47
    if (isClose) cursor += 1
    if (cursor < lineEnd && isAsciiLetter(markdown.charCodeAt(cursor))) {
      const tagStart = cursor
      cursor += 1
      while (cursor < lineEnd && isHtmlTagNameChar(markdown.charCodeAt(cursor))) cursor += 1
      const tagName = markdown.slice(tagStart, cursor).toLowerCase()
      if (
        !isClose &&
        (tagName === 'script' || tagName === 'pre' || tagName === 'style' || tagName === 'textarea')
      ) {
        return true
      }
      if (HTML_BLOCK_TAGS.has(tagName)) {
        const sep = cursor < lineEnd ? markdown.charCodeAt(cursor) : -1
        if (
          cursor === lineEnd ||
          sep === 32 ||
          sep === 62 ||
          (sep === 47 && cursor + 1 < lineEnd && markdown.charCodeAt(cursor + 1) === 62)
        ) {
          return true
        }
      }
    }
  }
  return false
}

const nextLineInterruptsParagraphBeforeCurrent = (
  markdown: string,
  lineStart: number,
  lineEnd: number,
  nextStart: number
): boolean => {
  if (nextStart >= markdown.length) return false
  let nextEnd = nextStart
  while (nextEnd < markdown.length) {
    const ch = markdown.charCodeAt(nextEnd)
    if (ch === 10 || ch === 13) break
    nextEnd += 1
  }
  if (nextStart >= nextEnd) return false
  if (matchesTableSeparatorRegex(markdown, nextStart, nextEnd, false).cells > 0) return true

  let lineHasPipe = false
  for (let i = lineStart; i < lineEnd; i += 1) {
    if (markdown.charCodeAt(i) === 124 /* | */) {
      lineHasPipe = true
      break
    }
  }
  if (!lineHasPipe) return false
  let nextHasDash = false
  let nextHasPipe = false
  for (let i = nextStart; i < nextEnd; i += 1) {
    const ch = markdown.charCodeAt(i)
    if (ch === 45 /* - */) nextHasDash = true
    else if (ch === 124 /* | */) nextHasPipe = true
    else if (ch !== 32 && ch !== 9 && ch !== 58 /* : */) return false
  }
  return nextHasDash && nextHasPipe
}

const findListPostMarkerStart = (
  markdown: string,
  start: number,
  lineEnd: number,
  skipTopLevelNonBullet: boolean
): number => {
  if (
    skipTopLevelNonBullet &&
    (isTaskListMarkerAt(markdown, start, lineEnd) ||
      matchOrderedListMarker(markdown, start, lineEnd) > 0)
  ) {
    return -1
  }
  let cursor = start
  let strippedAny = false
  while (cursor < lineEnd) {
    let spaces = 0
    while (cursor < lineEnd && markdown.charCodeAt(cursor) === 32 && spaces <= 3) {
      spaces += 1
      cursor += 1
    }
    if (spaces > 3 || cursor >= lineEnd) break

    let markerLen = 0
    const ch = markdown.charCodeAt(cursor)
    if (ch === 45 || ch === 42 || ch === 43) {
      markerLen = 1
    } else if (strippedAny && isAsciiDigit(ch)) {
      let digitEnd = cursor + 1
      while (digitEnd < lineEnd && isAsciiDigit(markdown.charCodeAt(digitEnd))) digitEnd += 1
      if (digitEnd < lineEnd && digitEnd - cursor <= 9) {
        const punct = markdown.charCodeAt(digitEnd)
        if (punct === 46 || punct === 41) {
          markerLen = digitEnd - cursor + 1
        }
      }
    }
    if (markerLen === 0) break

    const afterMarker = cursor + markerLen
    if (afterMarker >= lineEnd) return -1
    const firstWs = markdown.charCodeAt(afterMarker)
    if (firstWs !== 32 && firstWs !== 9) break

    let col = spaces + markerLen
    let wsCols = 0
    let p = afterMarker
    while (p < lineEnd) {
      const ws = markdown.charCodeAt(p)
      if (ws === 32) {
        wsCols += 1
        col += 1
        p += 1
      } else if (ws === 9) {
        const adv = 4 - (col % 4)
        wsCols += adv
        col += adv
        p += 1
      } else {
        break
      }
    }
    if (p >= lineEnd) return -1
    if (wsCols > 4) {
      // `marked` strips only 1 column when >= 5 spaces/tabs follow the marker, leaving indented code.
      return -1
    }
    cursor = p
    strippedAny = true
  }
  return strippedAny ? cursor : -1
}

const isHtmlTagNameChar = (ch: number): boolean =>
  isAsciiLetter(ch) || isAsciiDigit(ch) || ch === 45 || ch === 95

const isHtmlAttrStart = (ch: number): boolean => isAsciiLetter(ch) || ch === 58 || ch === 95

const isHtmlAttrNameChar = (ch: number): boolean =>
  isAsciiLetter(ch) || isAsciiDigit(ch) || ch === 95 || ch === 46 || ch === 58 || ch === 45

const isUnquotedAttrValChar = (ch: number): boolean =>
  !isHorizontalJsWhitespace(ch) &&
  ch !== 34 &&
  ch !== 39 &&
  ch !== 61 &&
  ch !== 60 &&
  ch !== 62 &&
  ch !== 96

const matchesLowerPrefix = (
  markdown: string,
  at: number,
  lineEnd: number,
  lowerPrefix: string
): boolean => {
  if (at + lowerPrefix.length > lineEnd) return false
  for (let i = 0; i < lowerPrefix.length; i += 1) {
    let ch = markdown.charCodeAt(at + i)
    if (ch >= 65 && ch <= 90) ch += 32
    if (ch !== lowerPrefix.charCodeAt(i)) return false
  }
  return true
}

const matchMidlineTaskListAt = (
  markdown: string,
  lineStart: number,
  lineEnd: number
): { minIndent: number; strip: number } | null => {
  if (lineStart + 5 >= lineEnd) return null
  let cursor = lineStart + 1
  let rawWs = 0
  let col = 0
  while (cursor < lineEnd) {
    const ch = markdown.charCodeAt(cursor)
    if (ch === 32) {
      rawWs += 1
      col += 1
      cursor += 1
    } else if (ch === 9) {
      rawWs += 1
      col += 4 - (col % 4)
      cursor += 1
    } else if (isHorizontalJsWhitespace(ch)) {
      rawWs += 1
      col += 1
      cursor += 1
    } else {
      break
    }
  }
  if (!isTaskListMarkerAt(markdown, cursor, lineEnd)) return null
  return { minIndent: rawWs, strip: Math.max(col, rawWs) + 2 }
}

const detectHtmlStartAt = (
  markdown: string,
  at: number,
  lineEnd: number,
  inParagraph: boolean,
  suppressTypes345: boolean
): { started: boolean; nextEnd: HtmlEnd; closeEnd: number; pendingCloseTag: boolean } => {
  if (at < 0 || at >= lineEnd || markdown.charCodeAt(at) !== 60 /* < */) {
    return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
  }

  if (
    at + 4 <= lineEnd &&
    markdown.charCodeAt(at + 1) === 33 &&
    markdown.charCodeAt(at + 2) === 45 &&
    markdown.charCodeAt(at + 3) === 45
  ) {
    const restStart = at + 4
    const closed =
      (restStart < lineEnd && markdown.charCodeAt(restStart) === 62) ||
      (restStart + 1 < lineEnd &&
        markdown.charCodeAt(restStart) === 45 &&
        markdown.charCodeAt(restStart + 1) === 62) ||
      findSubstrInRange(markdown, '-->', restStart, lineEnd) !== -1
    return {
      started: true,
      nextEnd: closed ? { kind: 'none' } : { kind: 'substr', needle: '-->' },
      closeEnd: -1,
      pendingCloseTag: false
    }
  }
  if (at + 2 <= lineEnd && markdown.charCodeAt(at + 1) === 63 /* ? */) {
    if (suppressTypes345) {
      return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
    }
    const closeIdx = findSubstrInRange(markdown, '?>', at + 2, lineEnd)
    return {
      started: true,
      nextEnd: closeIdx !== -1 ? { kind: 'none' } : { kind: 'substr', needle: '?>' },
      closeEnd: closeIdx !== -1 ? closeIdx + 2 : -1,
      pendingCloseTag: false
    }
  }
  if (matchesLowerPrefix(markdown, at, lineEnd, '<![cdata[')) {
    if (suppressTypes345) {
      return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
    }
    const closeIdx = findSubstrInRange(markdown, ']]>', at + 9, lineEnd)
    return {
      started: true,
      nextEnd: closeIdx !== -1 ? { kind: 'none' } : { kind: 'substr', needle: ']]>' },
      closeEnd: closeIdx !== -1 ? closeIdx + 3 : -1,
      pendingCloseTag: false
    }
  }
  if (
    at + 3 <= lineEnd &&
    markdown.charCodeAt(at + 1) === 33 &&
    isAsciiLetter(markdown.charCodeAt(at + 2))
  ) {
    if (suppressTypes345) {
      return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
    }
    const closeIdx = findSubstrInRange(markdown, '>', at + 3, lineEnd)
    return {
      started: true,
      nextEnd: closeIdx !== -1 ? { kind: 'none' } : { kind: 'substr', needle: '>' },
      closeEnd: closeIdx !== -1 ? closeIdx + 1 : -1,
      pendingCloseTag: false
    }
  }

  let cursor = at + 1
  const isCloseTag = cursor < lineEnd && markdown.charCodeAt(cursor) === 47
  if (isCloseTag) cursor += 1
  if (cursor >= lineEnd || !isAsciiLetter(markdown.charCodeAt(cursor))) {
    return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
  }
  const tagStart = cursor
  cursor += 1
  while (cursor < lineEnd && isHtmlTagNameChar(markdown.charCodeAt(cursor))) cursor += 1
  const rawTag = markdown.slice(tagStart, cursor)
  const tagName = rawTag.toLowerCase()

  if (inParagraph && rawTag !== tagName) {
    return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
  }

  if (
    !isCloseTag &&
    (tagName === 'script' || tagName === 'pre' || tagName === 'style' || tagName === 'textarea')
  ) {
    if (
      cursor === lineEnd ||
      markdown.charCodeAt(cursor) === 62 ||
      isHorizontalJsWhitespace(markdown.charCodeAt(cursor))
    ) {
      const closed = hasCaseInsensitiveTagClose(markdown, tagName, cursor, lineEnd)
      return {
        started: true,
        nextEnd: closed ? { kind: 'none' } : { kind: 'endTag', tag: tagName },
        closeEnd: -1,
        pendingCloseTag: false
      }
    }
  }

  if (HTML_BLOCK_TAGS.has(tagName)) {
    const sep = cursor < lineEnd ? markdown.charCodeAt(cursor) : -1
    if (
      cursor === lineEnd ||
      sep === 32 ||
      sep === 62 ||
      (sep === 47 && cursor + 1 < lineEnd && markdown.charCodeAt(cursor + 1) === 62)
    ) {
      return { started: true, nextEnd: { kind: 'blank' }, closeEnd: -1, pendingCloseTag: false }
    }
  }

  if (inParagraph || isRawHtmlPrefix(tagName)) {
    return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
  }

  if (isCloseTag) {
    while (cursor < lineEnd && isHorizontalJsWhitespace(markdown.charCodeAt(cursor))) cursor += 1
    if (cursor === lineEnd) {
      return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: true }
    }
    if (markdown.charCodeAt(cursor) === 62 && isAsciiBlank(markdown, cursor + 1, lineEnd)) {
      return { started: true, nextEnd: { kind: 'blank' }, closeEnd: -1, pendingCloseTag: false }
    }
    return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
  }

  while (cursor < lineEnd) {
    let spaces = 0
    while (cursor < lineEnd && markdown.charCodeAt(cursor) === 32) {
      spaces += 1
      cursor += 1
    }
    if (cursor >= lineEnd) {
      return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
    }
    const ch = markdown.charCodeAt(cursor)
    if (ch === 62 /* > */) {
      return isAsciiBlank(markdown, cursor + 1, lineEnd)
        ? { started: true, nextEnd: { kind: 'blank' }, closeEnd: -1, pendingCloseTag: false }
        : { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
    }
    if (ch === 47 /* / */ && cursor + 1 < lineEnd && markdown.charCodeAt(cursor + 1) === 62) {
      return isAsciiBlank(markdown, cursor + 2, lineEnd)
        ? { started: true, nextEnd: { kind: 'blank' }, closeEnd: -1, pendingCloseTag: false }
        : { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
    }
    if (spaces === 0 || !isHtmlAttrStart(ch)) {
      return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
    }
    cursor += 1
    while (cursor < lineEnd && isHtmlAttrNameChar(markdown.charCodeAt(cursor))) cursor += 1

    let eqScan = cursor
    while (eqScan < lineEnd && markdown.charCodeAt(eqScan) === 32) eqScan += 1
    if (eqScan < lineEnd && markdown.charCodeAt(eqScan) === 61 /* = */) {
      eqScan += 1
      while (eqScan < lineEnd && markdown.charCodeAt(eqScan) === 32) eqScan += 1
      if (eqScan >= lineEnd) {
        return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
      }
      const q = markdown.charCodeAt(eqScan)
      if (q === 34 || q === 39) {
        let closeQ = eqScan + 1
        while (closeQ < lineEnd && markdown.charCodeAt(closeQ) !== q) closeQ += 1
        if (closeQ >= lineEnd) {
          return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
        }
        cursor = closeQ + 1
      } else {
        let valEnd = eqScan
        while (valEnd < lineEnd && isUnquotedAttrValChar(markdown.charCodeAt(valEnd))) valEnd += 1
        if (valEnd === eqScan) {
          return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
        }
        cursor = valEnd
      }
    }
  }

  return { started: false, nextEnd: { kind: 'none' }, closeEnd: -1, pendingCloseTag: false }
}

const stepHtmlState = (
  htmlEnd: HtmlEnd,
  htmlCertain: boolean,
  markdown: string,
  leading: LineLeading,
  lineEnd: number,
  canBeOutside: boolean,
  effectiveMaxStrip: number,
  inParagraph: boolean,
  suppressTypes345: boolean,
  containerAt: number,
  postMarkerAt: number,
  canBeCertain: boolean
): {
  blocksFence: boolean
  nextEnd: HtmlEnd
  nextCertain: boolean
  startedTopLevel: boolean
  closeEnd: number
  startedPendingCloseTag: boolean
  startedPendingCloseCertain: boolean
} => {
  if (htmlEnd.kind === 'none') {
    if (
      canBeOutside &&
      effectiveMaxStrip === 0 &&
      leading.asciiSpaceIndent <= 3 &&
      (!inParagraph || !suppressTypes345 || leading.asciiSpaceIndent === 0)
    ) {
      const detected = detectHtmlStartAt(
        markdown,
        leading.asciiSpaceAt,
        lineEnd,
        inParagraph,
        suppressTypes345
      )
      if (detected.started) {
        return {
          blocksFence: true,
          nextEnd: detected.nextEnd,
          nextCertain: canBeCertain,
          startedTopLevel: true,
          closeEnd: detected.closeEnd,
          startedPendingCloseTag: false,
          startedPendingCloseCertain: false
        }
      }
      if (detected.pendingCloseTag && canBeCertain) {
        return {
          blocksFence: false,
          nextEnd: { kind: 'none' },
          nextCertain: true,
          startedTopLevel: false,
          closeEnd: -1,
          startedPendingCloseTag: true,
          startedPendingCloseCertain: true
        }
      }
    }

    if (!canBeOutside || effectiveMaxStrip > 0 || postMarkerAt !== -1) {
      if (containerAt !== -1) {
        const detected = detectHtmlStartAt(markdown, containerAt, lineEnd, false, false)
        if (detected.started) {
          return {
            blocksFence: true,
            nextEnd: detected.nextEnd,
            nextCertain: false,
            startedTopLevel: false,
            closeEnd: detected.closeEnd,
            startedPendingCloseTag: false,
            startedPendingCloseCertain: false
          }
        }
      }
      if (postMarkerAt !== -1) {
        const detected = detectHtmlStartAt(markdown, postMarkerAt, lineEnd, false, false)
        if (detected.started) {
          return {
            blocksFence: true,
            nextEnd: detected.nextEnd,
            nextCertain: false,
            startedTopLevel: false,
            closeEnd: detected.closeEnd,
            startedPendingCloseTag: false,
            startedPendingCloseCertain: false
          }
        }
      }
    }

    return {
      blocksFence: false,
      nextEnd: { kind: 'none' },
      nextCertain: true,
      startedTopLevel: false,
      closeEnd: -1,
      startedPendingCloseTag: false,
      startedPendingCloseCertain: false
    }
  }

  if (htmlEnd.kind === 'blank') {
    if (leading.asciiBlank) {
      return {
        blocksFence: false,
        nextEnd: { kind: 'none' },
        nextCertain: true,
        startedTopLevel: false,
        closeEnd: -1,
        startedPendingCloseTag: false,
        startedPendingCloseCertain: false
      }
    }
    if (!(htmlCertain && canBeCertain) && canBeOutside) {
      const candAt =
        leading.asciiSpaceIndent <= 3 &&
        leading.asciiSpaceAt < lineEnd &&
        markdown.charCodeAt(leading.asciiSpaceAt) === 60 /* < */
          ? leading.asciiSpaceAt
          : containerAt !== -1 &&
              containerAt < lineEnd &&
              markdown.charCodeAt(containerAt) === 60 /* < */
            ? containerAt
            : -1
      if (candAt !== -1) {
        const detected = detectHtmlStartAt(markdown, candAt, lineEnd, false, false)
        if (
          detected.started &&
          (detected.closeEnd !== -1 ||
            (detected.nextEnd.kind === 'substr' && detected.nextEnd.needle !== '-->'))
        ) {
          return {
            blocksFence: true,
            nextEnd: detected.nextEnd.kind !== 'none' ? detected.nextEnd : htmlEnd,
            nextCertain: false,
            startedTopLevel: false,
            closeEnd: detected.closeEnd,
            startedPendingCloseTag: false,
            startedPendingCloseCertain: false
          }
        }
      }
    }
    return {
      blocksFence: true,
      nextEnd: htmlEnd,
      nextCertain: htmlCertain && canBeCertain,
      startedTopLevel: false,
      closeEnd: -1,
      startedPendingCloseTag: false,
      startedPendingCloseCertain: false
    }
  }

  if (htmlEnd.kind === 'endTag') {
    const closed = hasCaseInsensitiveTagClose(markdown, htmlEnd.tag, leading.asciiSpaceAt, lineEnd)
    return {
      blocksFence: true,
      nextEnd: closed ? { kind: 'none' } : htmlEnd,
      nextCertain: closed ? true : htmlCertain && canBeCertain,
      startedTopLevel: false,
      closeEnd: -1,
      startedPendingCloseTag: false,
      startedPendingCloseCertain: false
    }
  }

  const closeIdx = findSubstrInRange(markdown, htmlEnd.needle, leading.asciiSpaceAt, lineEnd)
  const closed = closeIdx !== -1
  return {
    blocksFence: true,
    nextEnd: closed ? { kind: 'none' } : htmlEnd,
    nextCertain: closed ? true : htmlCertain && canBeCertain,
    startedTopLevel: false,
    closeEnd: closed && htmlEnd.needle !== '-->' ? closeIdx + htmlEnd.needle.length : -1,
    startedPendingCloseTag: false,
    startedPendingCloseCertain: false
  }
}

const hasMultiLineDefLabel = (
  markdown: string,
  scanFrom: number,
  sawNonWsInitial: boolean
): boolean => {
  let i = scanFrom
  let sawNonWs = sawNonWsInitial
  while (i < markdown.length) {
    const ch = markdown.charCodeAt(i)
    if (ch === 92 /* \ */) {
      sawNonWs = true
      i += 1
      if (i < markdown.length) {
        if (markdown.charCodeAt(i) === 13 && markdown.charCodeAt(i + 1) === 10) i += 2
        else i += 1
      }
      continue
    }
    if (ch === 91 /* [ */) return false
    if (ch === 93 /* ] */) {
      return sawNonWs && i + 1 < markdown.length && markdown.charCodeAt(i + 1) === 58 /* : */
    }
    if (ch !== 10 && ch !== 13 && !isHorizontalJsWhitespace(ch)) sawNonWs = true
    i += 1
  }
  return false
}

const parseDefTitleOnLine = (
  markdown: string,
  start: number,
  end: number,
  closeChar: number,
  escapable: boolean
): { nextDef: DefState; validComplete: boolean } => {
  let i = start
  while (i < end) {
    const ch = markdown.charCodeAt(i)
    if (escapable && ch === 92 /* \ */) {
      if (i + 1 < end && markdown.charCodeAt(i + 1) === 34 /* " */) {
        i += 2
      } else {
        i += 1
      }
      continue
    }
    if (closeChar === 41 /* ) */ && ch === 40 /* ( */) {
      return { nextDef: { kind: 'none' }, validComplete: false }
    }
    if (ch === closeChar) {
      return {
        nextDef: { kind: 'none' },
        validComplete: isAsciiSpaceOnly(markdown, i + 1, end)
      }
    }
    i += 1
  }
  return { nextDef: { kind: 'title', closeChar, escapable }, validComplete: false }
}

const parseDefAfterColon = (
  markdown: string,
  afterColon: number,
  end: number
): { nextDef: DefState; validComplete: boolean } => {
  let cursor = afterColon
  while (cursor < end && markdown.charCodeAt(cursor) === 32) cursor += 1
  if (cursor === end) return { nextDef: { kind: 'urlNext' }, validComplete: false }

  if (markdown.charCodeAt(cursor) === 60 /* < */) {
    let gt = cursor + 1
    while (gt < end && markdown.charCodeAt(gt) !== 62 /* > */) gt += 1
    if (gt >= end) return { nextDef: { kind: 'none' }, validComplete: false }
    cursor = gt + 1
  } else if (!isHorizontalJsWhitespace(markdown.charCodeAt(cursor))) {
    while (cursor < end && !isHorizontalJsWhitespace(markdown.charCodeAt(cursor))) cursor += 1
  } else {
    return { nextDef: { kind: 'none' }, validComplete: false }
  }

  let spaces = 0
  while (cursor < end && markdown.charCodeAt(cursor) === 32) {
    spaces += 1
    cursor += 1
  }
  if (cursor === end) return { nextDef: { kind: 'titleMaybe' }, validComplete: false }
  if (spaces === 0) return { nextDef: { kind: 'none' }, validComplete: false }

  const titleChar = markdown.charCodeAt(cursor)
  if (titleChar === 34) return parseDefTitleOnLine(markdown, cursor + 1, end, 34, true)
  if (titleChar === 39) return parseDefTitleOnLine(markdown, cursor + 1, end, 39, false)
  if (titleChar === 40) return parseDefTitleOnLine(markdown, cursor + 1, end, 41, false)
  return { nextDef: { kind: 'none' }, validComplete: false }
}

const startDefAt = (
  markdown: string,
  at: number,
  lineEnd: number,
  nextStart: number
): { started: boolean; blocksFence: boolean; nextDef: DefState; validComplete: boolean } => {
  if (at < 0 || at >= lineEnd || markdown.charCodeAt(at) !== 91 /* [ */) {
    return {
      started: false,
      blocksFence: false,
      nextDef: { kind: 'none' },
      validComplete: false
    }
  }
  let i = at + 1
  let sawNonWs = false
  while (i < lineEnd) {
    const ch = markdown.charCodeAt(i)
    if (ch === 92 /* \ */) {
      sawNonWs = true
      if (i + 1 >= lineEnd) {
        const isMulti = hasMultiLineDefLabel(markdown, nextStart, true)
        return isMulti
          ? { started: true, blocksFence: true, nextDef: { kind: 'label' }, validComplete: false }
          : { started: false, blocksFence: false, nextDef: { kind: 'none' }, validComplete: false }
      }
      i += 2
      continue
    }
    if (ch === 91 /* [ */) {
      return { started: false, blocksFence: false, nextDef: { kind: 'none' }, validComplete: false }
    }
    if (ch === 93 /* ] */) {
      if (sawNonWs && i + 1 < lineEnd && markdown.charCodeAt(i + 1) === 58 /* : */) {
        const parsed = parseDefAfterColon(markdown, i + 2, lineEnd)
        const ok = parsed.nextDef.kind !== 'none' || parsed.validComplete
        return {
          started: ok,
          blocksFence: ok,
          nextDef: parsed.nextDef,
          validComplete: parsed.validComplete
        }
      }
      return { started: false, blocksFence: false, nextDef: { kind: 'none' }, validComplete: false }
    }
    if (!isHorizontalJsWhitespace(ch)) sawNonWs = true
    i += 1
  }
  if (hasMultiLineDefLabel(markdown, nextStart, sawNonWs)) {
    return { started: true, blocksFence: true, nextDef: { kind: 'label' }, validComplete: false }
  }
  return { started: false, blocksFence: false, nextDef: { kind: 'none' }, validComplete: false }
}

const stepActiveDefState = (
  defState: Exclude<DefState, { kind: 'none' | 'titleMaybe' }>,
  markdown: string,
  lineStart: number,
  leading: LineLeading,
  lineEnd: number
): { blocksFence: boolean; nextDef: DefState; validComplete: boolean } => {
  if (defState.kind === 'label') {
    let i = lineStart
    while (i < lineEnd) {
      const ch = markdown.charCodeAt(i)
      if (ch === 92 /* \ */) {
        if (i + 1 >= lineEnd) {
          return { blocksFence: true, nextDef: { kind: 'label' }, validComplete: false }
        }
        i += 2
        continue
      }
      if (ch === 91 /* [ */) {
        return { blocksFence: false, nextDef: { kind: 'none' }, validComplete: false }
      }
      if (ch === 93 /* ] */) {
        if (i + 1 < lineEnd && markdown.charCodeAt(i + 1) === 58 /* : */) {
          const parsed = parseDefAfterColon(markdown, i + 2, lineEnd)
          return {
            blocksFence: parsed.nextDef.kind !== 'none' || parsed.validComplete,
            nextDef: parsed.nextDef,
            validComplete: parsed.validComplete
          }
        }
        return { blocksFence: false, nextDef: { kind: 'none' }, validComplete: false }
      }
      i += 1
    }
    return { blocksFence: true, nextDef: { kind: 'label' }, validComplete: false }
  }

  if (defState.kind === 'urlNext') {
    if (leading.asciiBlank) {
      return { blocksFence: false, nextDef: { kind: 'none' }, validComplete: false }
    }
    const parsed = parseDefAfterColon(markdown, leading.asciiWsAt, lineEnd)
    return {
      blocksFence: parsed.nextDef.kind !== 'none' || parsed.validComplete,
      nextDef: parsed.nextDef,
      validComplete: parsed.validComplete
    }
  }

  if (defState.closeChar === 39 && lineStart === lineEnd) {
    return { blocksFence: false, nextDef: { kind: 'none' }, validComplete: false }
  }
  const parsed = parseDefTitleOnLine(
    markdown,
    lineStart,
    lineEnd,
    defState.closeChar,
    defState.escapable
  )
  return { blocksFence: true, nextDef: parsed.nextDef, validComplete: parsed.validComplete }
}

const matchFenceRunAt = (
  markdown: string,
  at: number,
  end: number
): { char: '`' | '~'; length: number } | null => {
  if (at >= end) return null
  const ch = markdown.charCodeAt(at)
  if (ch !== 96 && ch !== 126) return null

  let run = at + 1
  while (run < end && markdown.charCodeAt(run) === ch) run += 1
  const length = run - at
  if (length < 3) return null

  if (ch === 96) {
    for (let i = run; i < end; i += 1) {
      if (markdown.charCodeAt(i) === 96) return null
    }
  }
  return { char: ch === 96 ? '`' : '~', length }
}

const matchOpeningFence = (
  markdown: string,
  leading: LineLeading,
  end: number,
  listMaxStrip: number,
  taskMaxStrip: number,
  orderedMaxStrip: number
): { fence: OpenFence; definiteOpen: boolean } | null => {
  const topRun =
    leading.asciiSpaceIndent <= 3 ? matchFenceRunAt(markdown, leading.asciiSpaceAt, end) : null
  if (topRun) {
    const isTopLevel = leading.asciiSpaceIndent === 0
    return {
      fence: {
        char: topRun.char,
        length: topRun.length,
        openIndent: leading.asciiSpaceIndent,
        couldBeInList: !isTopLevel && listMaxStrip > 0,
        couldBeInTaskList: !isTopLevel && taskMaxStrip > 0,
        couldBeInOrderedList: !isTopLevel && orderedMaxStrip > 0,
        listMaxStrip: isTopLevel ? 0 : listMaxStrip,
        taskMaxStrip: isTopLevel ? 0 : taskMaxStrip,
        orderedMaxStrip: isTopLevel ? 0 : orderedMaxStrip
      },
      definiteOpen: true
    }
  }

  if (listMaxStrip === 0 && taskMaxStrip === 0 && orderedMaxStrip === 0) return null

  const asciiRun =
    leading.colIndent <= Math.max(listMaxStrip, taskMaxStrip) + 3 ||
    leading.tabStopIndent <= taskMaxStrip + 3
      ? matchFenceRunAt(markdown, leading.asciiWsAt, end)
      : null
  const jsRun =
    orderedMaxStrip > 0 && leading.rawJsWsCount <= orderedMaxStrip + 3
      ? (asciiRun ?? matchFenceRunAt(markdown, leading.jsWsAt, end))
      : null
  const run = asciiRun ?? jsRun
  if (!run) return null

  const inList = listMaxStrip > 0 && Boolean(asciiRun) && leading.colIndent <= listMaxStrip + 3
  const inTask =
    taskMaxStrip > 0 &&
    Boolean(asciiRun) &&
    (leading.tabStopIndent <= taskMaxStrip + 3 || leading.colIndent <= taskMaxStrip + 3)
  const inOrdered =
    orderedMaxStrip > 0 && Boolean(jsRun) && leading.rawJsWsCount <= orderedMaxStrip + 3
  if (!inList && !inTask && !inOrdered) return null

  // Dedented container fences stay fail-closed (`definiteOpen: false`) so parity cannot invert.
  return {
    fence: {
      char: run.char,
      length: run.length,
      openIndent: Math.max(leading.asciiSpaceIndent, leading.colIndent, leading.rawJsWsCount),
      couldBeInList: inList,
      couldBeInTaskList: inTask,
      couldBeInOrderedList: inOrdered,
      listMaxStrip: inList ? listMaxStrip : 0,
      taskMaxStrip: inTask ? taskMaxStrip : 0,
      orderedMaxStrip: inOrdered ? orderedMaxStrip : 0
    },
    definiteOpen: false
  }
}

const matchesClosingTail = (
  markdown: string,
  at: number,
  end: number,
  fence: OpenFence
): { matched: boolean; asciiTrailingOnly: boolean } => {
  if (at >= end) return { matched: false, asciiTrailingOnly: false }
  const expected = fence.char === '`' ? 96 : 126
  if (markdown.charCodeAt(at) !== expected) return { matched: false, asciiTrailingOnly: false }

  let run = at + 1
  while (run < end && markdown.charCodeAt(run) === expected) run += 1
  if (run - at < fence.length) return { matched: false, asciiTrailingOnly: false }

  while (run < end) {
    const ch = markdown.charCodeAt(run)
    if (ch !== 96 && ch !== 126) break
    run += 1
  }

  if (isAsciiSpaceOnly(markdown, run, end)) {
    return { matched: true, asciiTrailingOnly: true }
  }
  if (fence.couldBeInList && isAsciiBlank(markdown, run, end)) {
    return { matched: true, asciiTrailingOnly: false }
  }
  return { matched: false, asciiTrailingOnly: false }
}

const closesFence = (
  markdown: string,
  leading: LineLeading,
  end: number,
  fence: OpenFence
): { closed: boolean; definite: boolean } => {
  const maxListClose = fence.couldBeInList ? Math.max(fence.openIndent, fence.listMaxStrip) + 3 : 3
  if (leading.colIndent <= maxListClose) {
    const tail = matchesClosingTail(markdown, leading.asciiWsAt, end, fence)
    if (tail.matched) {
      const definite =
        tail.asciiTrailingOnly &&
        leading.asciiSpaceIndent <= 3 &&
        leading.asciiSpaceAt === leading.asciiWsAt
      return { closed: true, definite }
    }
  }

  if (fence.couldBeInTaskList) {
    const maxTaskClose = Math.max(fence.openIndent, fence.taskMaxStrip) + 3
    if (leading.tabStopIndent <= maxTaskClose || leading.colIndent <= maxTaskClose) {
      const tail = matchesClosingTail(markdown, leading.asciiWsAt, end, fence)
      if (tail.matched) return { closed: true, definite: false }
    }
  }

  if (fence.couldBeInOrderedList) {
    const maxOrderedClose = Math.max(fence.openIndent, fence.orderedMaxStrip) + 3
    if (leading.rawJsWsCount <= maxOrderedClose) {
      const tail = matchesClosingTail(markdown, leading.jsWsAt, end, fence)
      if (tail.matched) return { closed: true, definite: false }
    }
  }

  return { closed: false, definite: false }
}

const sameFence = (a: OpenFence, b: OpenFence): boolean =>
  a.char === b.char &&
  a.length === b.length &&
  a.openIndent === b.openIndent &&
  a.couldBeInList === b.couldBeInList &&
  a.couldBeInTaskList === b.couldBeInTaskList &&
  a.couldBeInOrderedList === b.couldBeInOrderedList &&
  a.listMaxStrip === b.listMaxStrip &&
  a.taskMaxStrip === b.taskMaxStrip &&
  a.orderedMaxStrip === b.orderedMaxStrip

const pushFenceHypothesis = (list: OpenFence[], fence: OpenFence): void => {
  for (const existing of list) {
    if (sameFence(existing, fence)) return
  }
  list.push(fence)
}

/**
 * Single-pass O(n) guard before `marked` runs: `marked` parses `>` and list
 * nesting recursively and overflows the stack on adversarial inputs.
 */
const assertMarkdownNesting = (markdown: string): void => {
  let canBeOutside = true
  let fences: OpenFence[] = []
  let listMaxStrip = 0
  let listBulletChar = 0
  let listItemEmpty = false
  let taskMaxStrip = 0
  let taskMinIndent = Infinity
  let orderedMaxStrip = 0
  let sawBlankSinceList = false
  let htmlEnd: HtmlEnd = { kind: 'none' }
  let htmlCertain = true
  let htmlStartedInContainer = false
  let pendingHtmlCloseTag = false
  let pendingHtmlCloseCertain = false
  let defState: DefState = { kind: 'none' }
  let defUncertain = false
  const defSpeculativeFences: OpenFence[] = []
  let inParagraph = false
  let inTable = false
  let tableHeaderCells = 0
  let tableHeaderMaxRawCells = 0
  let tableMayEatLine = false
  let containerTableSawPipe = false
  let containerTableSawBacktick = false
  let inContainerTable = false
  let sawBlockquoteSinceAsciiSpaceBlank = false
  let sawBlockquoteListSinceAsciiSpaceBlank = false
  let sawBlockquoteLazyAfterList = false
  let defFailedSinceAsciiSpaceBlank = false
  let forceUncertainOnPhysicalLine = false
  let currentPhysicalLineEnd = -1
  let currentPhysicalNextStart = -1
  let lineStart = 0

  while (lineStart <= markdown.length) {
    if (currentPhysicalLineEnd < lineStart) {
      let end = lineStart
      while (end < markdown.length) {
        const ch = markdown.charCodeAt(end)
        if (ch === 10 || ch === 13) break
        end += 1
      }
      currentPhysicalLineEnd = end
      currentPhysicalNextStart =
        end < markdown.length &&
        markdown.charCodeAt(end) === 13 &&
        markdown.charCodeAt(end + 1) === 10
          ? end + 2
          : end + 1
      forceUncertainOnPhysicalLine = false
    }
    const lineEnd = currentPhysicalLineEnd
    const nextStart = currentPhysicalNextStart

    const leading = measureLineLeading(markdown, lineStart, lineEnd)
    const blank = leading.jsBlank

    let nextOutside = false
    const nextFences: OpenFence[] = []
    let evaluateFromOutside = canBeOutside
    const fencesWereEmpty = fences.length === 0
    const wasInTable = inTable
    const hadPriorListContainer = listMaxStrip > 0 || taskMaxStrip > 0 || orderedMaxStrip > 0

    if (canBeOutside && defState.kind === 'titleMaybe') {
      const nextCh =
        !blank && leading.asciiWsAt < lineEnd ? markdown.charCodeAt(leading.asciiWsAt) : -1
      if (blank || (nextCh !== 34 && nextCh !== 39 && nextCh !== 40)) {
        if (!defUncertain && defSpeculativeFences.length > 0) {
          fences = fences.filter((f) => !defSpeculativeFences.some((sf) => sameFence(f, sf)))
        }
        defSpeculativeFences.length = 0
        defUncertain = false
        defState = { kind: 'none' }
      }
    }

    const orderedItemMarker =
      !blank && leading.jsWsAt < lineEnd
        ? matchOrderedListMarker(markdown, leading.jsWsAt, lineEnd)
        : 0

    let closedFenceOnLine = false
    for (const f of fences) {
      const containerExitIndent =
        f.couldBeInOrderedList || f.couldBeInTaskList
          ? Math.min(leading.colIndent, leading.rawJsWsCount)
          : leading.colIndent
      const containerExit =
        !blank &&
        (f.couldBeInList || f.couldBeInTaskList || f.couldBeInOrderedList) &&
        containerExitIndent < f.openIndent
      if (containerExit) {
        evaluateFromOutside = true
      }

      const closeResult = !blank
        ? closesFence(markdown, leading, lineEnd, f)
        : { closed: false, definite: false }
      if (closeResult.closed) {
        closedFenceOnLine = true
        nextOutside = true
        if (!closeResult.definite || containerExit) {
          pushFenceHypothesis(nextFences, f)
        }
        continue
      }

      if (!blank && f.couldBeInOrderedList && orderedItemMarker > 0) {
        nextOutside = true
        pushFenceHypothesis(nextFences, f)
        continue
      }

      pushFenceHypothesis(nextFences, f)
    }

    let htmlBlocksFence = false
    let htmlStartedValidTopLevel = false
    let insideCertainHtml = false
    let htmlSplitCloseEnd = -1
    let defBlocksFence = false
    let defEndedValidTopLevel = false
    let openedFromOutside: OpenFence | null = null
    let effectiveInParagraph = false

    if (evaluateFromOutside) {
      const lineIsTaskMarker =
        !blank && leading.jsWsAt < lineEnd && isTaskListMarkerAt(markdown, leading.jsWsAt, lineEnd)
      const effectiveTaskStrip =
        !blank && !lineIsTaskMarker && leading.rawJsWsCount <= taskMinIndent ? 0 : taskMaxStrip
      const lineIsBulletMarker =
        !blank &&
        leading.asciiSpaceIndent <= 3 &&
        leading.asciiSpaceAt < lineEnd &&
        (markdown.charCodeAt(leading.asciiSpaceAt) === 45 ||
          markdown.charCodeAt(leading.asciiSpaceAt) === 42 ||
          markdown.charCodeAt(leading.asciiSpaceAt) === 43) &&
        (leading.asciiSpaceAt + 1 === lineEnd ||
          ((markdown.charCodeAt(leading.asciiSpaceAt + 1) === 32 ||
            markdown.charCodeAt(leading.asciiSpaceAt + 1) === 9) &&
            (leading.asciiSpaceAt + 2 < lineEnd ||
              (listMaxStrip > 0 && markdown.charCodeAt(leading.asciiSpaceAt) === listBulletChar))))
      const effectiveListStrip =
        !blank &&
        ((sawBlankSinceList && leading.colIndent < 2) ||
          (listItemEmpty && !lineIsBulletMarker && leading.colIndent < listMaxStrip))
          ? 0
          : listMaxStrip
      const effectiveOrderedStrip =
        !blank && sawBlankSinceList && leading.rawJsWsCount === 0 ? 0 : orderedMaxStrip
      const effectiveMaxStrip = Math.max(
        effectiveListStrip,
        effectiveTaskStrip,
        effectiveOrderedStrip
      )
      const canBeCertain =
        canBeOutside &&
        effectiveMaxStrip === 0 &&
        !sawBlockquoteSinceAsciiSpaceBlank &&
        !forceUncertainOnPhysicalLine

      let containerAt = -1
      if (!blank && (effectiveMaxStrip > 0 || !canBeOutside)) {
        if (leading.asciiSpaceIndent <= 3 && leading.asciiSpaceAt === leading.jsWsAt) {
          containerAt = leading.asciiSpaceAt
        } else if (
          (effectiveListStrip > 0 && leading.colIndent <= effectiveListStrip + 3) ||
          (effectiveTaskStrip > 0 &&
            (leading.tabStopIndent <= effectiveTaskStrip + 3 ||
              leading.colIndent <= effectiveTaskStrip + 3))
        ) {
          containerAt = leading.asciiWsAt
        } else if (effectiveOrderedStrip > 0 && leading.rawJsWsCount <= effectiveOrderedStrip + 3) {
          containerAt = leading.jsWsAt
        }
      }

      let postMarkerAt = -1
      if (!blank) {
        if (leading.asciiSpaceIndent <= 3) {
          postMarkerAt = findListPostMarkerStart(markdown, leading.asciiSpaceAt, lineEnd, true)
        } else if (containerAt !== -1) {
          postMarkerAt = findListPostMarkerStart(markdown, containerAt, lineEnd, false)
        }
      }

      const pruneValidDefFences = () => {
        if (!defUncertain && defSpeculativeFences.length > 0) {
          let writeIdx = 0
          for (let i = 0; i < nextFences.length; i += 1) {
            const nf = nextFences[i]!
            let isSpeculative = false
            for (const sf of defSpeculativeFences) {
              if (sameFence(nf, sf)) {
                isSpeculative = true
                break
              }
            }
            if (!isSpeculative) {
              nextFences[writeIdx] = nf
              writeIdx += 1
            }
          }
          nextFences.length = writeIdx
        }
        defSpeculativeFences.length = 0
        defUncertain = false
      }

      let handledActiveDef = false
      if (defState.kind === 'titleMaybe') {
        if (!blank && leading.asciiWsAt < lineEnd) {
          const ch = markdown.charCodeAt(leading.asciiWsAt)
          if (ch === 34 || ch === 39 || ch === 40) {
            const closeChar = ch === 40 ? 41 : ch
            const parsed = parseDefTitleOnLine(
              markdown,
              leading.asciiWsAt + 1,
              lineEnd,
              closeChar,
              ch === 34
            )
            defBlocksFence = true
            defState = parsed.nextDef
            handledActiveDef = true
            if (!canBeCertain || !fencesWereEmpty || defFailedSinceAsciiSpaceBlank) {
              defUncertain = true
            }
            if (defState.kind === 'none') {
              if (parsed.validComplete && !defUncertain) {
                pruneValidDefFences()
                defEndedValidTopLevel = true
              } else {
                if (!parsed.validComplete) defFailedSinceAsciiSpaceBlank = true
                defSpeculativeFences.length = 0
                defUncertain = false
              }
            }
          }
        }
        if (!handledActiveDef) {
          pruneValidDefFences()
          defState = { kind: 'none' }
        }
      } else if (defState.kind !== 'none') {
        handledActiveDef = true
        if (!canBeCertain || !fencesWereEmpty || defFailedSinceAsciiSpaceBlank) {
          defUncertain = true
        }
        const step = stepActiveDefState(defState, markdown, lineStart, leading, lineEnd)
        defBlocksFence = step.blocksFence
        defState = step.nextDef
        if (defState.kind === 'none') {
          if (step.validComplete && !defUncertain) {
            pruneValidDefFences()
            defEndedValidTopLevel = true
          } else {
            if (!step.validComplete) defFailedSinceAsciiSpaceBlank = true
            defSpeculativeFences.length = 0
            defUncertain = false
          }
        }
      }

      const lookaheadInterruptedParagraph =
        inParagraph &&
        !inTable &&
        canBeOutside &&
        effectiveMaxStrip === 0 &&
        !blank &&
        ((leading.asciiSpaceIndent <= 3 &&
          leading.asciiSpaceAt < lineEnd &&
          (markdown.charCodeAt(leading.asciiSpaceAt) === 60 /* < */ ||
            markdown.charCodeAt(leading.asciiSpaceAt) === 91)) /* [ */ ||
          orderedItemMarker > 0) &&
        nextLineInterruptsParagraphBeforeCurrent(markdown, lineStart, lineEnd, nextStart)

      const exitedListToTopLevel = effectiveMaxStrip === 0 && hadPriorListContainer && !blank
      effectiveInParagraph =
        (inParagraph || inTable) && !exitedListToTopLevel && !lookaheadInterruptedParagraph

      const defMustBeUncertain =
        !canBeCertain ||
        !fencesWereEmpty ||
        postMarkerAt !== -1 ||
        containerAt !== -1 ||
        defFailedSinceAsciiSpaceBlank ||
        lookaheadInterruptedParagraph

      if (effectiveMaxStrip === 0 && hadPriorListContainer && htmlStartedInContainer) {
        htmlEnd = { kind: 'none' }
        htmlCertain = true
        htmlStartedInContainer = false
      }
      if (effectiveMaxStrip === 0 && hadPriorListContainer && !pendingHtmlCloseCertain) {
        pendingHtmlCloseTag = false
        pendingHtmlCloseCertain = false
      }

      if (!handledActiveDef && defState.kind === 'none' && !blank && htmlEnd.kind === 'none') {
        if (
          canBeOutside &&
          effectiveMaxStrip === 0 &&
          !effectiveInParagraph &&
          leading.asciiSpaceIndent <= 3 &&
          leading.asciiSpaceAt < lineEnd &&
          markdown.charCodeAt(leading.asciiSpaceAt) === 91 /* [ */
        ) {
          const started = startDefAt(markdown, leading.asciiSpaceAt, lineEnd, nextStart)
          if (started.started) {
            defBlocksFence = started.blocksFence
            defState = started.nextDef
            defUncertain = defMustBeUncertain
            if (defState.kind === 'none') {
              if (started.validComplete && !defUncertain) defEndedValidTopLevel = true
              defSpeculativeFences.length = 0
              defUncertain = false
            }
          }
        } else if (!canBeOutside || effectiveMaxStrip > 0 || postMarkerAt !== -1) {
          const candAt =
            containerAt !== -1 && markdown.charCodeAt(containerAt) === 91
              ? containerAt
              : postMarkerAt !== -1 && markdown.charCodeAt(postMarkerAt) === 91
                ? postMarkerAt
                : -1
          if (candAt !== -1) {
            const started = startDefAt(markdown, candAt, lineEnd, nextStart)
            if (started.started) {
              defBlocksFence = started.blocksFence
              defState = started.nextDef
              defUncertain = true
              if (defState.kind === 'none') {
                defSpeculativeFences.length = 0
                defUncertain = false
              }
            }
          }
        }
      }

      let resolvedPendingHtmlClose = false
      if (pendingHtmlCloseTag && htmlEnd.kind === 'none' && !blank) {
        pendingHtmlCloseTag = false
        if (
          !defBlocksFence &&
          leading.jsWsAt < lineEnd &&
          markdown.charCodeAt(leading.jsWsAt) === 62 /* > */ &&
          isAsciiBlank(markdown, leading.jsWsAt + 1, lineEnd)
        ) {
          resolvedPendingHtmlClose = true
          const certainClose =
            pendingHtmlCloseCertain &&
            canBeCertain &&
            fencesWereEmpty &&
            leading.jsWsAt === leading.asciiSpaceAt
          pendingHtmlCloseCertain = false
          htmlEnd = { kind: 'blank' }
          htmlCertain = certainClose
          htmlStartedInContainer = !certainClose
          htmlBlocksFence = true
          htmlStartedValidTopLevel = certainClose
        } else {
          pendingHtmlCloseCertain = false
        }
      }

      const prevHtmlEndKind = htmlEnd.kind
      const prevHtmlCertain = htmlCertain
      let wasCertainHtml = false

      if (
        !resolvedPendingHtmlClose &&
        (htmlEnd.kind !== 'none' || (!blank && defState.kind === 'none' && !defBlocksFence))
      ) {
        const htmlStep = stepHtmlState(
          htmlEnd,
          htmlCertain,
          markdown,
          leading,
          lineEnd,
          canBeOutside,
          effectiveMaxStrip,
          effectiveInParagraph,
          effectiveInParagraph && !sawBlockquoteSinceAsciiSpaceBlank,
          containerAt,
          postMarkerAt,
          canBeCertain && fencesWereEmpty
        )
        htmlEnd = htmlStep.nextEnd
        htmlCertain = htmlStep.nextCertain
        if (htmlEnd.kind === 'none') {
          htmlStartedInContainer = false
        } else if (prevHtmlEndKind === 'none') {
          htmlStartedInContainer = !htmlStep.startedTopLevel || !canBeCertain || !fencesWereEmpty
        }
        htmlBlocksFence = htmlStep.blocksFence
        htmlStartedValidTopLevel = htmlStep.startedTopLevel
        htmlSplitCloseEnd = htmlStep.closeEnd
        if (htmlStep.startedPendingCloseTag) {
          pendingHtmlCloseTag = true
          pendingHtmlCloseCertain = htmlStep.startedPendingCloseCertain
        }
        wasCertainHtml =
          prevHtmlEndKind === 'none'
            ? htmlStep.startedTopLevel && canBeCertain && fencesWereEmpty
            : prevHtmlCertain && canBeCertain && fencesWereEmpty
      } else if (resolvedPendingHtmlClose) {
        wasCertainHtml = htmlCertain
      }

      if (htmlBlocksFence && wasCertainHtml) {
        insideCertainHtml = true
        listMaxStrip = 0
        listBulletChar = 0
        listItemEmpty = false
        taskMaxStrip = 0
        taskMinIndent = Infinity
        orderedMaxStrip = 0
        sawBlankSinceList = false
      }

      if (htmlSplitCloseEnd !== -1 && htmlSplitCloseEnd < lineEnd && wasCertainHtml) {
        canBeOutside = true
        fences = []
        listMaxStrip = 0
        listBulletChar = 0
        listItemEmpty = false
        taskMaxStrip = 0
        taskMinIndent = Infinity
        orderedMaxStrip = 0
        sawBlankSinceList = false
        htmlEnd = { kind: 'none' }
        htmlCertain = true
        htmlStartedInContainer = false
        pendingHtmlCloseTag = false
        pendingHtmlCloseCertain = false
        defState = { kind: 'none' }
        defUncertain = false
        defSpeculativeFences.length = 0
        inParagraph = false
        inTable = false
        tableHeaderCells = 0
        tableHeaderMaxRawCells = 0
        tableMayEatLine = false
        containerTableSawPipe = false
        containerTableSawBacktick = false
        inContainerTable = false
        if (isAsciiBlank(markdown, htmlSplitCloseEnd, lineEnd)) {
          if (lineEnd >= markdown.length) break
          lineStart = nextStart
          continue
        }
        forceUncertainOnPhysicalLine = true
        lineStart = htmlSplitCloseEnd
        continue
      }

      // Suppress fence opening exclusively ONLY on certain top-level HTML blocks.
      const blockPreventsOpen = htmlBlocksFence || defBlocksFence
      const exclusiveSuppress = htmlBlocksFence && htmlCertain && !defBlocksFence
      if (blank || exclusiveSuppress) {
        nextOutside = true
      } else {
        if (blockPreventsOpen) {
          nextOutside = true
        }
        const opened = matchOpeningFence(
          markdown,
          leading,
          lineEnd,
          listMaxStrip,
          taskMaxStrip,
          orderedMaxStrip
        )
        if (opened) {
          openedFromOutside = opened.fence
          pendingHtmlCloseTag = false
          pendingHtmlCloseCertain = false
          const alreadyInNext = nextFences.some((nf) => sameFence(nf, opened.fence))
          if (!alreadyInNext) {
            nextFences.push(opened.fence)
            if (defBlocksFence || defState.kind !== 'none') {
              defSpeculativeFences.push(opened.fence)
            }
          }
          const allowDefiniteOpen =
            opened.definiteOpen &&
            fencesWereEmpty &&
            !closedFenceOnLine &&
            !blockPreventsOpen &&
            !sawBlockquoteLazyAfterList &&
            !defFailedSinceAsciiSpaceBlank &&
            !forceUncertainOnPhysicalLine &&
            !tableMayEatLine &&
            !wasInTable
          if (!allowDefiniteOpen) {
            nextOutside = true
          }
        } else {
          nextOutside = true
        }
      }
    } else {
      htmlEnd = { kind: 'none' }
      htmlCertain = true
      htmlStartedInContainer = false
      pendingHtmlCloseTag = false
      pendingHtmlCloseCertain = false
      defState = { kind: 'none' }
      defUncertain = false
      defSpeculativeFences.length = 0
      inParagraph = false
      inTable = false
      tableHeaderCells = 0
      tableHeaderMaxRawCells = 0
      tableMayEatLine = false
      containerTableSawPipe = false
      containerTableSawBacktick = false
      inContainerTable = false
    }

    if (nextFences.length > MAX_FENCE_HYPOTHESES) {
      nextOutside = true
      nextFences.length = 0
      defSpeculativeFences.length = 0
      defUncertain = true
    }

    const activeLineEnd =
      htmlSplitCloseEnd !== -1 && htmlSplitCloseEnd < lineEnd ? htmlSplitCloseEnd : lineEnd

    if (canBeOutside || nextOutside) {
      if (blank) {
        if (listMaxStrip > 0 || orderedMaxStrip > 0) sawBlankSinceList = true
        pendingHtmlCloseCertain = false
        containerTableSawPipe = false
        containerTableSawBacktick = false
        inContainerTable = false
        if (isAsciiSpaceOnly(markdown, lineStart, activeLineEnd)) {
          inParagraph = false
          inTable = false
          sawBlockquoteSinceAsciiSpaceBlank = false
          sawBlockquoteListSinceAsciiSpaceBlank = false
          sawBlockquoteLazyAfterList = false
          defFailedSinceAsciiSpaceBlank = false
          tableMayEatLine = false
        } else {
          if (sawBlockquoteListSinceAsciiSpaceBlank) {
            sawBlockquoteLazyAfterList = true
          }
          if (hadPriorListContainer) {
            inParagraph = false
            inTable = false
          } else if (inTable) {
            if (matchesMarkedCodeStart(markdown, leading, activeLineEnd)) {
              inTable = false
              inParagraph = false
              tableMayEatLine = false
            }
          } else if (!insideCertainHtml && !inParagraph) {
            inParagraph = !leading.asciiBlank && leading.colIndent < 4
          }
        }
        tableHeaderCells = 0
        tableHeaderMaxRawCells = 0
      } else {
        const maxActiveStrip = Math.max(listMaxStrip, taskMaxStrip, orderedMaxStrip)
        let stackedMarkers = 0
        let totalIndent = 0
        let cursor = lineStart
        let sawBlockquote = false
        let sawListInsideBlockquote = false
        let lineListStrip = -1
        let lineListBulletChar = 0
        let lineListItemEmpty = false
        let lineTaskStrip = -1
        let lineOrderedStrip = -1
        let lineOrderedDigitCount = 0
        let firstListHasWs = false

        while (cursor < activeLineEnd) {
          const pre = measureDepthIndent(markdown, cursor, activeLineEnd)
          const preCol = totalIndent + pre.indent
          totalIndent = preCol
          cursor = pre.at
          if (cursor >= activeLineEnd) break

          const canSetListFromHere =
            !sawBlockquote &&
            (stackedMarkers === 0
              ? maxActiveStrip > 0
                ? preCol <= maxActiveStrip + 3
                : preCol <= 3 && leading.asciiSpaceAt === cursor
              : (lineListStrip >= 0 || lineTaskStrip >= 0 || lineOrderedStrip >= 0) &&
                pre.indent <= 3)

          const ch = markdown.charCodeAt(cursor)
          if (ch === 62 /* > */) {
            sawBlockquote = true
            cursor += 1
            if (
              cursor < activeLineEnd &&
              (markdown.charCodeAt(cursor) === 32 || markdown.charCodeAt(cursor) === 9)
            ) {
              cursor += 1
            }
            stackedMarkers += 1
            continue
          }

          if (!sawBlockquote && isTaskListMarkerAt(markdown, cursor, activeLineEnd)) {
            const tabCol = cursor === lineStart ? leading.tabStopIndent : preCol
            const strip = Math.max(tabCol, preCol, taskMaxStrip) + 2
            lineTaskStrip = Math.max(lineTaskStrip, strip)
            if (listMaxStrip > 0) {
              let wsAfter = 0
              let p = cursor + 1
              while (p < activeLineEnd) {
                const s = markdown.charCodeAt(p)
                if (s === 32) {
                  wsAfter += 1
                  p += 1
                } else if (s === 9) {
                  wsAfter += 4 - ((preCol + 1 + wsAfter) % 4)
                  p += 1
                } else {
                  break
                }
              }
              if (wsAfter === 0 || wsAfter > 4) wsAfter = 1
              lineListStrip = Math.max(lineListStrip, preCol + 1 + wsAfter)
              if (lineListBulletChar === 0) lineListBulletChar = ch
              lineListItemEmpty = p === activeLineEnd
            }
            if (stackedMarkers === 0) firstListHasWs = true
            cursor += 2
            stackedMarkers += 1
            continue
          }

          const orderedLen = matchOrderedListMarker(markdown, cursor, activeLineEnd)
          if (orderedLen > 0) {
            if (!sawBlockquote) {
              const rawPre = cursor === lineStart ? leading.rawJsWsCount : preCol
              const strip = Math.max(rawPre, preCol) + orderedLen + 1
              lineOrderedStrip = Math.max(lineOrderedStrip, strip)
              if (stackedMarkers === 0) {
                firstListHasWs = true
                if (isAsciiDigit(markdown.charCodeAt(cursor))) {
                  lineOrderedDigitCount = orderedLen
                }
              }
            } else {
              sawListInsideBlockquote = true
            }
            cursor += orderedLen + 2
            stackedMarkers += 1
            continue
          }

          if (ch === 45 || ch === 42 || ch === 43) {
            if (cursor + 1 === activeLineEnd) {
              if (canSetListFromHere && (maxActiveStrip > 0 || (!inTable && !inParagraph))) {
                lineListStrip = Math.max(lineListStrip, preCol + 2)
                if (lineListBulletChar === 0) lineListBulletChar = ch
                lineListItemEmpty = true
              } else if (sawBlockquote) {
                sawListInsideBlockquote = true
              }
              cursor += 1
              stackedMarkers += 1
              continue
            }
            const nextCh = markdown.charCodeAt(cursor + 1)
            if (isHorizontalJsWhitespace(nextCh)) {
              const isAsciiSpaceOrTab = nextCh === 32 || nextCh === 9
              const validMarkedBullet =
                isAsciiSpaceOrTab &&
                (cursor + 2 < activeLineEnd ||
                  (!sawBlockquote && listMaxStrip > 0 && ch === listBulletChar))
              if (validMarkedBullet) {
                if (canSetListFromHere) {
                  let wsAfter = 0
                  let sawTabAfter = false
                  let p = cursor + 1
                  const colAfter = preCol + 1
                  while (p < activeLineEnd) {
                    const s = markdown.charCodeAt(p)
                    if (s === 32) {
                      wsAfter += 1
                      p += 1
                    } else if (s === 9) {
                      sawTabAfter = true
                      wsAfter += 4 - ((colAfter + wsAfter) % 4)
                      p += 1
                    } else {
                      break
                    }
                  }
                  if (p === activeLineEnd || wsAfter === 0 || wsAfter > 4) wsAfter = 1
                  if (sawTabAfter && (orderedMaxStrip > 0 || taskMaxStrip > 0) && wsAfter < 4) {
                    wsAfter = 4
                  }
                  lineListStrip = Math.max(lineListStrip, colAfter + wsAfter)
                  if (lineListBulletChar === 0) lineListBulletChar = ch
                  lineListItemEmpty = p === activeLineEnd
                  if (stackedMarkers === 0) firstListHasWs = true
                } else if (sawBlockquote) {
                  sawListInsideBlockquote = true
                }
              }
              cursor += 2
              stackedMarkers += 1
              continue
            }
          }

          if (isAsciiDigit(ch)) {
            let digitEnd = cursor + 1
            while (digitEnd < activeLineEnd && isAsciiDigit(markdown.charCodeAt(digitEnd))) {
              digitEnd += 1
            }
            if (digitEnd < activeLineEnd) {
              const punct = markdown.charCodeAt(digitEnd)
              if (
                (punct === 46 || punct === 41) &&
                digitEnd + 1 === activeLineEnd &&
                digitEnd - cursor <= 9
              ) {
                if (canSetListFromHere && (maxActiveStrip > 0 || (!inTable && !inParagraph))) {
                  lineListStrip = Math.max(lineListStrip, preCol + (digitEnd - cursor) + 2)
                  lineListItemEmpty = true
                } else if (sawBlockquote) {
                  sawListInsideBlockquote = true
                }
                cursor = digitEnd + 1
                stackedMarkers += 1
                continue
              }
            }
          }

          break
        }

        const depth = stackedMarkers + Math.floor(totalIndent / 2)
        if (depth > MAX_MARKDOWN_NESTING) {
          throw new MarkdownTooDeepError(depth)
        }

        if (insideCertainHtml) {
          inParagraph = false
          inTable = false
          tableHeaderCells = 0
          tableHeaderMaxRawCells = 0
          tableMayEatLine = false
          containerTableSawPipe = false
          containerTableSawBacktick = false
          inContainerTable = false
          canBeOutside = nextOutside
          fences = nextFences
          if (lineEnd >= markdown.length) break
          lineStart = nextStart
          continue
        }

        if (sawBlockquote) {
          sawBlockquoteSinceAsciiSpaceBlank = true
          if (sawListInsideBlockquote) {
            sawBlockquoteListSinceAsciiSpaceBlank = true
          }
        } else if (sawBlockquoteListSinceAsciiSpaceBlank && openedFromOutside === null) {
          sawBlockquoteLazyAfterList = true
        }

        if (htmlSplitCloseEnd !== -1 && htmlSplitCloseEnd < lineEnd) {
          canBeOutside = nextOutside
          fences = nextFences
          htmlEnd = { kind: 'none' }
          htmlCertain = true
          htmlStartedInContainer = false
          if (isAsciiBlank(markdown, htmlSplitCloseEnd, lineEnd)) {
            if (lineEnd >= markdown.length) break
            lineStart = nextStart
            continue
          }
          forceUncertainOnPhysicalLine = true
          inParagraph = false
          inTable = false
          tableHeaderCells = 0
          tableHeaderMaxRawCells = 0
          tableMayEatLine = false
          containerTableSawPipe = false
          containerTableSawBacktick = false
          inContainerTable = false
          lineStart = htmlSplitCloseEnd
          continue
        }

        const hadNoActiveContainer =
          listMaxStrip === 0 && taskMaxStrip === 0 && orderedMaxStrip === 0
        const startsOneItem =
          leading.asciiSpaceIndent <= 3 &&
          leading.asciiSpaceAt + 2 < activeLineEnd &&
          markdown.charCodeAt(leading.asciiSpaceAt) === 49 /* 1 */ &&
          (markdown.charCodeAt(leading.asciiSpaceAt + 1) === 46 ||
            markdown.charCodeAt(leading.asciiSpaceAt + 1) === 41) &&
          (markdown.charCodeAt(leading.asciiSpaceAt + 2) === 32 ||
            markdown.charCodeAt(leading.asciiSpaceAt + 2) === 9)
        const effectiveLineOrderedStrip =
          hadNoActiveContainer && effectiveInParagraph && !startsOneItem ? -1 : lineOrderedStrip

        if (openedFromOutside?.openIndent === 0) {
          listMaxStrip = 0
          listBulletChar = 0
          listItemEmpty = false
          taskMaxStrip = 0
          taskMinIndent = Infinity
          orderedMaxStrip = 0
          sawBlankSinceList = false
        } else if (effectiveLineOrderedStrip >= 0 || lineTaskStrip >= 0 || lineListStrip >= 0) {
          if (leading.rawJsWsCount === 0) {
            if (effectiveLineOrderedStrip >= 0) {
              orderedMaxStrip = effectiveLineOrderedStrip
              if (sawBlankSinceList || (lineOrderedDigitCount > 0 && lineOrderedDigitCount <= 9)) {
                listMaxStrip = 0
                listBulletChar = 0
                listItemEmpty = false
              }
              taskMaxStrip = 0
              taskMinIndent = Infinity
            } else if (lineTaskStrip >= 0) {
              taskMaxStrip = leading.tabStopIndent + 2
              taskMinIndent = 0
              orderedMaxStrip = 0
              listMaxStrip = lineListStrip >= 0 ? lineListStrip : 0
              listBulletChar = lineListStrip >= 0 ? lineListBulletChar : 0
              listItemEmpty = lineListStrip >= 0 ? lineListItemEmpty : false
            } else if (lineListStrip >= 0) {
              listMaxStrip = lineListStrip
              listBulletChar = lineListBulletChar
              listItemEmpty = lineListItemEmpty
              taskMaxStrip = 0
              taskMinIndent = Infinity
              if (firstListHasWs || sawBlankSinceList) orderedMaxStrip = 0
            }
          } else {
            if (effectiveLineOrderedStrip >= 0) {
              orderedMaxStrip = Math.max(orderedMaxStrip, effectiveLineOrderedStrip)
            }
            if (lineTaskStrip >= 0) {
              taskMaxStrip = Math.max(taskMaxStrip, lineTaskStrip)
              taskMinIndent = Math.min(taskMinIndent, leading.rawJsWsCount)
            } else if (leading.rawJsWsCount <= taskMinIndent) {
              taskMaxStrip = 0
              taskMinIndent = Infinity
            }
            if (lineListStrip >= 0) {
              listMaxStrip = Math.max(listMaxStrip, lineListStrip)
              if (listBulletChar === 0) listBulletChar = lineListBulletChar
              listItemEmpty = lineListItemEmpty
            } else if (
              (sawBlankSinceList && leading.colIndent < 2) ||
              (listItemEmpty && leading.colIndent < listMaxStrip)
            ) {
              listMaxStrip = 0
              listBulletChar = 0
              listItemEmpty = false
            } else if (listMaxStrip > 0 && leading.colIndent >= listMaxStrip) {
              listItemEmpty = false
            }
          }
          sawBlankSinceList = false
        } else if (leading.rawJsWsCount === 0) {
          taskMaxStrip = 0
          taskMinIndent = Infinity
          const interruptor = isListInterruptorAtZero(
            markdown,
            leading,
            activeLineEnd,
            listMaxStrip
          )
          if (sawBlankSinceList || listItemEmpty || interruptor.stopsMarkedList) {
            listMaxStrip = 0
            listBulletChar = 0
            listItemEmpty = false
          }
          if (sawBlankSinceList || interruptor.stopsOrderedList) orderedMaxStrip = 0
          if (sawBlankSinceList) sawBlankSinceList = false
        } else {
          if (leading.rawJsWsCount <= taskMinIndent) {
            taskMaxStrip = 0
            taskMinIndent = Infinity
          }
          if (listItemEmpty && leading.colIndent < listMaxStrip) {
            listMaxStrip = 0
            listBulletChar = 0
            listItemEmpty = false
          } else if (listMaxStrip > 0 && leading.colIndent >= listMaxStrip) {
            listItemEmpty = false
          }
          if (sawBlankSinceList) {
            if (leading.colIndent < 2) {
              listMaxStrip = 0
              listBulletChar = 0
              listItemEmpty = false
            } else if (listMaxStrip > 0) {
              sawBlankSinceList = false
            }
          }
        }

        const isBlockquoteLine =
          leading.asciiSpaceIndent <= 3 &&
          leading.asciiSpaceAt < activeLineEnd &&
          markdown.charCodeAt(leading.asciiSpaceAt) === 62 /* > */

        if (
          !effectiveInParagraph &&
          !inTable &&
          listMaxStrip === 0 &&
          taskMaxStrip === 0 &&
          orderedMaxStrip === 0 &&
          !insideCertainHtml &&
          !htmlBlocksFence &&
          !defBlocksFence &&
          openedFromOutside === null &&
          !closedFenceOnLine &&
          leading.rawJsWsCount === 0 &&
          lineTaskStrip < 0 &&
          lineListStrip < 0 &&
          effectiveLineOrderedStrip < 0 &&
          !isBlockquoteLine &&
          !isParagraphTerminator(
            markdown,
            leading.asciiSpaceAt,
            activeLineEnd,
            inParagraph,
            inTable
          )
        ) {
          const midlineTask = matchMidlineTaskListAt(markdown, lineStart, activeLineEnd)
          if (midlineTask) {
            taskMaxStrip = midlineTask.strip
            taskMinIndent = midlineTask.minIndent
            orderedMaxStrip = 0
            listMaxStrip = 0
            listBulletChar = 0
            listItemEmpty = false
            sawBlankSinceList = false
          }
        }

        const hasAnyActiveList = listMaxStrip > 0 || taskMaxStrip > 0 || orderedMaxStrip > 0

        const delimInfo =
          !inTable &&
          (tableHeaderCells > 0 || tableHeaderMaxRawCells > 0) &&
          !hasAnyActiveList &&
          leading.asciiSpaceIndent <= 3 &&
          openedFromOutside === null &&
          !closedFenceOnLine &&
          htmlEnd.kind === 'none' &&
          !htmlStartedValidTopLevel &&
          !defEndedValidTopLevel &&
          defState.kind === 'none' &&
          lineTaskStrip < 0 &&
          lineListStrip < 0
            ? countTableDelimiterInfo(markdown, leading.asciiSpaceAt, activeLineEnd)
            : { cells: 0, hasPipe: false }

        if (openedFromOutside !== null || closedFenceOnLine) {
          inParagraph = false
          inTable = false
          tableHeaderCells = 0
          tableHeaderMaxRawCells = 0
        } else if (htmlBlocksFence || htmlEnd.kind !== 'none' || htmlStartedValidTopLevel) {
          inParagraph = false
          inTable = false
          tableHeaderCells = 0
          tableHeaderMaxRawCells = 0
        } else if (defEndedValidTopLevel || defState.kind !== 'none') {
          inParagraph = false
          inTable = false
          tableHeaderCells = 0
          tableHeaderMaxRawCells = 0
        } else if (leading.colIndent >= 4 && !hasAnyActiveList) {
          if (inTable) {
            inTable = false
            inParagraph = false
          }
          tableHeaderCells = 0
          tableHeaderMaxRawCells = 0
        } else if (
          lineTaskStrip >= 0 ||
          lineListStrip >= 0 ||
          effectiveLineOrderedStrip >= 0 ||
          hasAnyActiveList
        ) {
          inParagraph = false
          inTable = false
          tableHeaderCells = 0
          tableHeaderMaxRawCells = 0
        } else if (
          leading.asciiSpaceIndent <= 3 &&
          isParagraphTerminator(markdown, leading.asciiSpaceAt, activeLineEnd, inParagraph, inTable)
        ) {
          inParagraph = false
          inTable = false
          tableHeaderCells = 0
          tableHeaderMaxRawCells = 0
        } else if (
          delimInfo.cells > 0 &&
          (delimInfo.cells === tableHeaderCells ||
            (delimInfo.hasPipe && delimInfo.cells <= tableHeaderMaxRawCells))
        ) {
          inTable = true
          inParagraph = false
          tableHeaderCells = 0
          tableHeaderMaxRawCells = 0
          tableMayEatLine = true
        } else if (inTable) {
          if (startsOneItem || isBlockquoteLine) {
            inTable = false
            inParagraph = false
          }
          tableHeaderCells = 0
          tableHeaderMaxRawCells = 0
        } else {
          inParagraph = true
          if (
            !hasAnyActiveList &&
            leading.colIndent < 4 &&
            !isBlockquoteLine &&
            effectiveLineOrderedStrip < 0
          ) {
            const headerInfo = analyzeTableHeaderLine(markdown, leading.asciiSpaceAt, activeLineEnd)
            tableHeaderCells = headerInfo.cells
            tableHeaderMaxRawCells = headerInfo.maxRawCells
          } else {
            tableHeaderCells = 0
            tableHeaderMaxRawCells = 0
          }
        }

        if (
          hasAnyActiveList &&
          leading.asciiWsAt < activeLineEnd &&
          openedFromOutside === null &&
          !closedFenceOnLine &&
          !htmlBlocksFence &&
          !defBlocksFence
        ) {
          const lineHasBacktick =
            findSubstrInRange(markdown, '`', leading.asciiWsAt, activeLineEnd) !== -1
          if (inContainerTable) {
            if (lineHasBacktick) containerTableSawBacktick = true
            if (containerTableSawBacktick) tableMayEatLine = true
          } else if (
            containerTableSawPipe &&
            countTableDelimiterInfo(markdown, leading.asciiWsAt, activeLineEnd).cells > 0
          ) {
            inContainerTable = true
            if (lineHasBacktick) containerTableSawBacktick = true
            if (containerTableSawBacktick) tableMayEatLine = true
          } else {
            containerTableSawPipe =
              findSubstrInRange(markdown, '|', leading.asciiWsAt, activeLineEnd) !== -1
            containerTableSawBacktick = containerTableSawPipe && lineHasBacktick
          }
        } else {
          containerTableSawPipe = false
          containerTableSawBacktick = false
          inContainerTable = false
        }

        if (inTable) {
          tableMayEatLine = true
        } else if (
          (wasInTable || tableMayEatLine) &&
          !inContainerTable &&
          (openedFromOutside !== null ||
            closedFenceOnLine ||
            stopsMarkedTable(markdown, leading, activeLineEnd))
        ) {
          tableMayEatLine = false
        }
      }
    } else if (openedFromOutside?.openIndent === 0) {
      listMaxStrip = 0
      listBulletChar = 0
      listItemEmpty = false
      taskMaxStrip = 0
      taskMinIndent = Infinity
      orderedMaxStrip = 0
      sawBlankSinceList = false
      inParagraph = false
      inTable = false
      tableHeaderCells = 0
      tableHeaderMaxRawCells = 0
      tableMayEatLine = false
      containerTableSawPipe = false
      containerTableSawBacktick = false
      inContainerTable = false
    } else if (!blank && orderedItemMarker > 0) {
      orderedMaxStrip = Math.max(orderedMaxStrip, leading.rawJsWsCount + orderedItemMarker + 1)
    }

    canBeOutside = nextOutside
    fences = nextFences

    if (lineEnd >= markdown.length) break
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
