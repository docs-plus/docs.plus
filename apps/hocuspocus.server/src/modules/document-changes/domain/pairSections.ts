import { type BlockKey, matchBlocks } from '../../document-versions/domain/matchBlocks'
import { MAX_DIFF_LCS_CELLS } from '../../document-versions/types'
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

/**
 * Sections that kept their text and their toc-id, but not their place.
 * Index equality would call every later section moved after one insertion.
 * The ids outside one common subsequence are the ones that moved.
 */
export function movedTocIds(baseline: Section[], pairs: SectionPair[]): ReadonlySet<string> {
  const same = pairs.filter(
    (pair): pair is { baseline: Section; head: Section } =>
      pair.baseline !== null &&
      pair.head !== null &&
      pair.baseline.tocId !== null &&
      pair.baseline.tocId === pair.head.tocId &&
      canonicalSection(pair.baseline) === canonicalSection(pair.head)
  )
  const pos = new Map(baseline.map((section, index) => [section, index]))
  const beforeIds = [...same]
    .sort((a, b) => (pos.get(a.baseline) ?? 0) - (pos.get(b.baseline) ?? 0))
    .map((pair) => pair.baseline.tocId as string)
  const afterIds = same.map((pair) => pair.head.tocId as string)
  return idsOutsideLcs(beforeIds, afterIds)
}

function idsOutsideLcs(allBefore: string[], allAfter: string[]): Set<string> {
  let start = 0
  while (
    start < allBefore.length &&
    start < allAfter.length &&
    allBefore[start] === allAfter[start]
  ) {
    start += 1
  }
  let endBefore = allBefore.length
  let endAfter = allAfter.length
  while (
    endBefore > start &&
    endAfter > start &&
    allBefore[endBefore - 1] === allAfter[endAfter - 1]
  ) {
    endBefore -= 1
    endAfter -= 1
  }
  const before = allBefore.slice(start, endBefore)
  const after = allAfter.slice(start, endAfter)
  const moved = new Set<string>()
  // Above the cell cap, skip move detection; sections still pair by id.
  if (before.length * after.length > MAX_DIFF_LCS_CELLS) return moved

  const n = before.length
  const m = after.length
  const width = m + 1
  const dp = new Int32Array((n + 1) * width)

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * width + j] =
        before[i] === after[j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1])
    }
  }

  const kept = new Set<string>()
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      kept.add(before[i])
      i += 1
      j += 1
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      i += 1
    } else {
      j += 1
    }
  }

  for (const id of before) if (!kept.has(id)) moved.add(id)
  for (const id of after) if (!kept.has(id)) moved.add(id)
  return moved
}
