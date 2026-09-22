import { ChangeSet, simplifyChanges } from '@tiptap/pm/changeset'
import type { Node as PMNode } from '@tiptap/pm/model'
import { StepMap } from '@tiptap/pm/transform'

import { blockText } from '../../../lib/blockText'
import { getMigrationSchema } from '../../../lib/migration-extensions'
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

const MAX_RUN_CHARS = 800

function cleanRun(text: string): string {
  const flat = text.replace(/\s+/g, ' ')
  const lead = flat.startsWith(' ') ? ' ' : ''
  const trail = flat.endsWith(' ') ? ' ' : ''
  const core = flat.trim()
  if (!core) return ''
  return `${lead}${core}${trail}`
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

function capRuns(runs: SectionChangeRun[]): SectionChangeRun[] {
  let left = MAX_RUN_CHARS
  const out: SectionChangeRun[] = []
  for (const run of runs) {
    const lead = run.text.startsWith(' ') ? ' ' : ''
    const trail = run.text.endsWith(' ') ? ' ' : ''
    const core = sanitizeText(run.text, left)
    const text = core ? `${lead}${core}${trail}`.slice(0, left) : ''
    if (!text) break
    out.push({ kind: run.kind, text })
    left -= text.length
    if (left <= 0) break
  }
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
    const before = contextBefore(docB.textBetween(cursor, change.fromB, '\n', ' '))
    if (before) pushRun(runs, 'same', before)
    const removed = docA.textBetween(change.fromA, change.toA, '\n', ' ')
    const added = docB.textBetween(change.fromB, change.toB, '\n', ' ')
    if (removed) pushRun(runs, 'removed', removed)
    if (added) pushRun(runs, 'added', added)
    cursor = change.toB
  }
  return capRuns(runs)
}

const sectionDoc = (section: Section): PMNode =>
  getMigrationSchema().nodeFromJSON({ type: 'doc', content: sectionNodes(section) })

/** A whole section arrived or went, so every word counts and no diff is needed. */
const wholeSection = (section: Section, status: 'added' | 'removed'): Quantified => {
  const nodes = sectionNodes(section)
  const words = countWords(blockText(nodes, ' '))
  return {
    magnitude:
      status === 'added'
        ? { wordsAdded: words, wordsRemoved: 0, blocksBefore: 0, blocksAfter: nodes.length }
        : { wordsAdded: 0, wordsRemoved: words, blocksBefore: nodes.length, blocksAfter: 0 },
    excerpt: status === 'added' ? blockText(section.nodes, ' ') : '',
    removedExcerpt: status === 'removed' ? blockText(section.nodes, ' ') : '',
    runs: capRuns([
      {
        kind: status === 'added' ? 'added' : 'removed',
        text: blockText(section.nodes, ' ')
      }
    ])
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
 * id rather than its text, so a debug log never holds document content.
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

    const excerpt = sanitizeText(quantified.excerpt, EXCERPT_MAX_CHARS)
    const removedExcerpt = sanitizeText(quantified.removedExcerpt, EXCERPT_MAX_CHARS)
    return {
      tocId: section.tocId,
      text: section.headingText,
      level: section.level,
      status,
      magnitude: quantified.magnitude,
      ...(excerpt.length > 0 ? { excerpt } : {}),
      ...(removedExcerpt.length > 0 ? { removedExcerpt } : {}),
      ...(quantified.runs.length > 0 ? { runs: quantified.runs } : {})
    }
  })
