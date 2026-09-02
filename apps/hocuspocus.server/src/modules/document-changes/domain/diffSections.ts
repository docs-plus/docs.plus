import { ChangeSet, simplifyChanges } from '@tiptap/pm/changeset'
import type { Node as PMNode } from '@tiptap/pm/model'
import { StepMap } from '@tiptap/pm/transform'

import { blockText } from '../../../lib/blockText'
import { getMigrationSchema } from '../../../lib/migration-extensions'
import type { Section, SectionChange, SectionMagnitude, SectionPair, SectionStatus } from '../types'
import { EXCERPT_MAX_CHARS } from '../types'
import { canonicalSection, sectionNodes } from './canonicalSection'
import { countWords, sanitizeText } from './sanitizeText'

interface Quantified {
  magnitude: SectionMagnitude | null
  excerpt: string
}

const NOTHING: Quantified = { magnitude: null, excerpt: '' }

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
    excerpt: status === 'added' ? blockText(section.nodes, ' ') : ''
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
  for (const change of changes) {
    const inserted = docB.textBetween(change.fromB, change.toB, ' ', ' ')
    wordsAdded += countWords(inserted)
    wordsRemoved += countWords(docA.textBetween(change.fromA, change.toA, ' ', ' '))
    if (inserted.length > widest.length) widest = inserted
  }

  return {
    magnitude: {
      wordsAdded,
      wordsRemoved,
      blocksBefore: docA.childCount,
      blocksAfter: docB.childCount
    },
    excerpt: widest
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
  onError?: (error: unknown, tocId: string | null) => void
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
            ? 'unchanged'
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
    return {
      tocId: section.tocId,
      text: section.headingText,
      level: section.level,
      status,
      magnitude: quantified.magnitude,
      ...(excerpt.length > 0 ? { excerpt } : {})
    }
  })
