import { ChangeSet, simplifyChanges } from '@tiptap/pm/changeset'
import type { Node as PMNode } from '@tiptap/pm/model'
import { StepMap } from '@tiptap/pm/transform'

import { blockText } from '../../../lib/blockText'
import { getMigrationSchema } from '../../../lib/migration-extensions'
import { EMBED_NODE_TYPES } from '../../document-conversion/domain/portableJson'
import type {
  Section,
  SectionChange,
  SectionChangeRun,
  SectionMagnitude,
  SectionPair,
  SectionStatus
} from '../types'
import { EXCERPT_MAX_CHARS } from '../types'
import { canonicalSection, sectionNodes } from './canonicalSection'
import { countWords, sanitizeText } from './sanitizeText'

interface Quantified {
  magnitude: SectionMagnitude | null
  excerpt: string
  removedExcerpt: string
  runs: SectionChangeRun[]
}

const NOTHING: Quantified = { magnitude: null, excerpt: '', removedExcerpt: '', runs: [] }

const MAX_CONTEXT_CHARS = 800

// JS `\s` covers U+00A0. The zero-width space, non-joiner and joiner, the word
// joiner, the bidi marks (LRM, RLM, ALM) and the emoji variation selector draw
// nothing alone. An edit made only of them is not a change. An alternation,
// because ESLint rejects a class that holds U+200D or U+FE0F.
const INVISIBLE = /\s|\u200b|\u200c|\u200d|\u2060|\u200e|\u200f|\u061c|\ufe0f/gu
const hasVisibleText = (text: string): boolean => text.replace(INVISIBLE, '').length > 0

/** Media has no text, so an added or removed one would otherwise read as a space. */
function leafWord(node: PMNode): string {
  const name = node.type.name
  if (name === 'image') return ' image '
  // `video` is also in EMBED_NODE_TYPES, so it must be tested first.
  if (name === 'video') return ' video '
  return EMBED_NODE_TYPES.has(name) ? ' embed ' : ' '
}

function cleanRun(text: string): string {
  if (!hasVisibleText(text)) return ''
  const flat = text.replace(/\s+/g, ' ')
  const lead = flat.startsWith(' ') ? ' ' : ''
  const trail = flat.endsWith(' ') ? ' ' : ''
  const core = flat.trim()
  return `${lead}${core}${trail}`
}

function pushGap(runs: SectionChangeRun[]): void {
  if (runs.length > 0 && runs[runs.length - 1]?.kind !== 'gap') runs.push({ kind: 'gap', text: '' })
}

function pushRun(runs: SectionChangeRun[], kind: SectionChangeRun['kind'], text: string): void {
  const clean = cleanRun(text)
  if (!clean) return
  const last = runs[runs.length - 1]
  if (last && last.kind === kind) {
    const gap = last.text.endsWith(' ') || clean.startsWith(' ') ? '' : ' '
    last.text = `${last.text}${gap}${clean}`
    return
  }
  runs.push({ kind, text: clean })
}

/** The words just before a change, from the start of that sentence. */
function contextBefore(text: string): string {
  const tail = text.slice(-100)
  const breakAt = Math.max(
    tail.lastIndexOf('. '),
    tail.lastIndexOf('! '),
    tail.lastIndexOf('? '),
    tail.lastIndexOf('\n')
  )
  const slice = breakAt >= 0 ? tail.slice(breakAt + 1) : tail
  return slice.replace(/^\s+/, '')
}

/**
 * Context shares the budget; every edit keeps at least an excerpt, so a long
 * early edit cannot hide a later one. One section can therefore outgrow the
 * budget, and the mail fit is what bounds the whole message.
 */
function capRuns(runs: SectionChangeRun[]): SectionChangeRun[] {
  let left = MAX_CONTEXT_CHARS
  const out: SectionChangeRun[] = []
  for (const run of runs) {
    if (run.kind === 'gap') {
      pushGap(out)
      continue
    }
    const room = run.kind === 'same' ? left : Math.max(left, EXCERPT_MAX_CHARS)
    if (room <= 0) {
      pushGap(out)
      continue
    }
    const lead = run.text.startsWith(' ') ? ' ' : ''
    const trail = run.text.endsWith(' ') ? ' ' : ''
    const core = sanitizeText(run.text, room)
    const text = core ? `${lead}${core}${trail}`.slice(0, room) : ''
    if (!text) continue
    out.push({ kind: run.kind, text })
    left = Math.max(0, left - text.length)
  }
  if (out.at(-1)?.kind === 'gap') out.pop()
  return out
}

function runsAround(
  docA: PMNode,
  docB: PMNode,
  changes: { fromA: number; toA: number; fromB: number; toB: number }[]
): SectionChangeRun[] {
  const runs: SectionChangeRun[] = []
  let cursor = 0
  for (const change of changes) {
    const removed = docA.textBetween(change.fromA, change.toA, '\n', leafWord)
    const added = docB.textBetween(change.fromB, change.toB, '\n', leafWord)
    // An invisible edit gets no context either, or the passage paints grey only.
    // It also leaves the cursor, so the next gap spans the skipped edit.
    if (!hasVisibleText(removed) && !hasVisibleText(added)) continue
    const gap = docB.textBetween(cursor, change.fromB, '\n', ' ')
    const before = contextBefore(gap)
    // Without a marker, two edits far apart paint as one sentence.
    if (gap.trim().length > before.trim().length) pushGap(runs)
    if (before) pushRun(runs, 'same', before)
    pushRun(runs, 'removed', removed)
    pushRun(runs, 'added', added)
    cursor = change.toB
  }
  return capRuns(runs)
}

const sectionDoc = (section: Section): PMNode =>
  getMigrationSchema().nodeFromJSON({ type: 'doc', content: sectionNodes(section) })

/**
 * The body as a reader sees it, with media as a word. The schema throws on a
 * node it does not know. The summary counts read the magnitude, so a throw falls
 * back to plain text here and never reaches the caller's guard.
 */
const bodyText = (section: Section): string => {
  try {
    const body = getMigrationSchema().nodeFromJSON({ type: 'doc', content: section.nodes })
    return body.textBetween(0, body.content.size, ' ', leafWord)
  } catch {
    return blockText(section.nodes, ' ')
  }
}

/** A whole section arrived or went, so every word counts and no diff is needed. */
const wholeSection = (section: Section, status: 'added' | 'removed'): Quantified => {
  const nodes = sectionNodes(section)
  const words = countWords(blockText(nodes, ' '))
  const body = bodyText(section)
  return {
    magnitude:
      status === 'added'
        ? { wordsAdded: words, wordsRemoved: 0, blocksBefore: 0, blocksAfter: nodes.length }
        : { wordsAdded: 0, wordsRemoved: words, blocksBefore: nodes.length, blocksAfter: 0 },
    excerpt: status === 'added' ? body : '',
    removedExcerpt: status === 'removed' ? body : '',
    runs: capRuns([{ kind: status, text: body.trim() }])
  }
}

/**
 * Word and block deltas for a section already called modified. The default token
 * encoder reads neither marks nor attributes, so bold, a changed href and a
 * heading level report zero changes. That is a null magnitude, never a
 * reclassification: the edit happened, and only its size is unknown.
 */
const quantify = (baseline: Section, head: Section): Quantified => {
  const docA = sectionDoc(baseline)
  const docB = sectionDoc(head)
  const changes = simplifyChanges(
    ChangeSet.create(docA).addSteps(
      docB,
      [new StepMap([0, docA.content.size, docB.content.size])],
      [0]
    ).changes,
    docB
  )
  if (changes.length === 0) return NOTHING

  let wordsAdded = 0
  let wordsRemoved = 0
  let widest = ''
  let widestRemoved = ''
  for (const change of changes) {
    const inserted = docB.textBetween(change.fromB, change.toB, ' ', ' ')
    const removed = docA.textBetween(change.fromA, change.toA, ' ', ' ')
    wordsAdded += countWords(inserted)
    wordsRemoved += countWords(removed)
    if (inserted.length > widest.length) widest = inserted
    if (removed.length > widestRemoved.length) widestRemoved = removed
  }

  return {
    magnitude: {
      wordsAdded,
      wordsRemoved,
      blocksBefore: docA.childCount,
      blocksAfter: docB.childCount
    },
    excerpt: widest,
    removedExcerpt: widestRemoved,
    runs: runsAround(docA, docB, changes)
  }
}

/**
 * Status and magnitude per pair, in the order pairing produced. `onError` sees a
 * quantifier that threw, which reads the same as an unquantifiable edit in the
 * response and must not be confused with one in the logs. It carries the section
 * id, not its text, so the log never holds document content.
 */
export const diffSections = (
  pairs: SectionPair[],
  onError?: (error: unknown, tocId: string | null) => void,
  moved: ReadonlySet<string> = new Set()
): SectionChange[] =>
  pairs.map((pair) => {
    // Branch on the pair, never on a status computed elsewhere: the narrowing is
    // what lets both sides be read without a cast. Classification cannot throw,
    // so only the measurement sits inside the guard.
    const section = pair.head ?? pair.baseline
    const status: SectionStatus =
      pair.baseline === null
        ? 'added'
        : pair.head === null
          ? 'removed'
          : canonicalSection(pair.baseline) === canonicalSection(pair.head)
            ? pair.baseline.tocId !== null && moved.has(pair.baseline.tocId)
              ? 'moved'
              : 'unchanged'
            : 'modified'

    let quantified = NOTHING
    try {
      if (pair.baseline === null) quantified = wholeSection(pair.head, 'added')
      else if (pair.head === null) quantified = wholeSection(pair.baseline, 'removed')
      else if (status === 'modified') quantified = quantify(pair.baseline, pair.head)
    } catch (error) {
      onError?.(error, section.tocId)
    }

    // A passage with no green or red word is grey text only, so the runs and
    // both excerpts go together.
    const shown = quantified.runs.some(
      (run) => (run.kind === 'added' || run.kind === 'removed') && hasVisibleText(run.text)
    )
    const runs = shown ? quantified.runs : []
    const visible = (value: string): string => {
      const clean = sanitizeText(value, EXCERPT_MAX_CHARS)
      return shown && hasVisibleText(clean) ? clean : ''
    }
    const excerpt = visible(quantified.excerpt)
    const removedExcerpt = visible(quantified.removedExcerpt)
    // The level is part of the canonical form, so a level change is always modified.
    const previousLevel =
      pair.baseline !== null && pair.head !== null && pair.baseline.level !== pair.head.level
        ? pair.baseline.level
        : null
    return {
      tocId: section.tocId,
      text: section.headingText,
      level: section.level,
      status,
      magnitude: quantified.magnitude,
      ...(previousLevel !== null ? { previousLevel } : {}),
      ...(excerpt.length > 0 ? { excerpt } : {}),
      ...(removedExcerpt.length > 0 ? { removedExcerpt } : {}),
      ...(runs.length > 0 ? { runs } : {})
    }
  })
