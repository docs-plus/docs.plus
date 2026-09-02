import { type BlockKey, matchBlocks } from '../../document-versions/domain/matchBlocks'
import type { Section, SectionPair } from '../types'
import { canonicalSection } from './canonicalSection'

/**
 * LCS only says added or removed, so a rename would surface as two events. Zipping
 * a run back into one pair is right only where identity is uncertain: two sections
 * that both carry a toc-id and still did not match are two different sections, and
 * merging them hides a deletion and calls a new section an edit.
 */
const zippable = (before: Section, after: Section): boolean =>
  (before.tocId === null || after.tocId === null) && before.level === after.level

/** All one type, so an adjacent removed/added run reaches `zippable` at all. */
const sectionKey = (section: Section): BlockKey => ({
  hash: canonicalSection(section),
  nodeType: 'section'
})

/**
 * Ordered pairs in head order, each removed run kept behind the last baseline
 * section that did pair. Identity is toc-id first, then LCS over the leftovers.
 * There is no title exemption: overruling a stable toc-id reports one deleted
 * heading as two contradictory rows.
 */
export const pairSections = (baseline: Section[], head: Section[]): SectionPair[] => {
  const headOf = new Array<number>(baseline.length).fill(-1)
  const baseOf = new Array<number>(head.length).fill(-1)

  const pair = (b: number, h: number): void => {
    headOf[b] = h
    baseOf[h] = b
  }

  // The preamble carries no toc-id and no name, so position is its only identity.
  if (baseline[0]?.level === 0 && head[0]?.level === 0) pair(0, 0)

  // First occurrence wins; a duplicate inside one snapshot falls to the LCS pool.
  const byTocId = new Map<string, number>()
  baseline.forEach((section, index) => {
    if (headOf[index] !== -1 || section.tocId === null) return
    if (!byTocId.has(section.tocId)) byTocId.set(section.tocId, index)
  })
  head.forEach((section, index) => {
    if (baseOf[index] !== -1 || section.tocId === null) return
    const match = byTocId.get(section.tocId)
    if (match === undefined || headOf[match] !== -1) return
    pair(match, index)
  })

  const leftBase: number[] = []
  const leftHead: number[] = []
  headOf.forEach((h, b) => {
    if (h === -1) leftBase.push(b)
  })
  baseOf.forEach((b, h) => {
    if (b === -1) leftHead.push(h)
  })

  if (leftBase.length > 0 && leftHead.length > 0) {
    // `coarse` is unreachable here: it needs 1000 unpaired headings a side, and
    // it degrades to add-all plus remove-all, which over-reports and never lies.
    const { matches } = matchBlocks(
      leftBase.map((b) => sectionKey(baseline[b])),
      leftHead.map((h) => sectionKey(head[h]))
    )
    for (const match of matches) {
      if (match.kind === 'unchanged') pair(leftBase[match.a], leftHead[match.b])
      else if (
        match.kind === 'changed' &&
        zippable(baseline[leftBase[match.a]], head[leftHead[match.b]])
      ) {
        pair(leftBase[match.a], leftHead[match.b])
      }
    }
  }

  const removedAfter = new Map<number, number[]>()
  let lastPairedHead = -1
  headOf.forEach((h, b) => {
    if (h !== -1) {
      lastPairedHead = h
      return
    }
    const bucket = removedAfter.get(lastPairedHead)
    if (bucket) bucket.push(b)
    else removedAfter.set(lastPairedHead, [b])
  })

  const pairs: SectionPair[] = []
  const emitRemoved = (after: number): void => {
    for (const b of removedAfter.get(after) ?? []) pairs.push({ baseline: baseline[b], head: null })
  }

  emitRemoved(-1)
  head.forEach((section, index) => {
    pairs.push({ baseline: baseOf[index] === -1 ? null : baseline[baseOf[index]], head: section })
    emitRemoved(index)
  })

  return pairs
}
