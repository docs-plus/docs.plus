/**
 * TDD tests for E-2: findPrevBlock STACK-ATTACH fallback + DRY/SOLID improvements.
 *
 * Strategy: RED → GREEN → REFACTOR
 *
 * E-2: When the heading map contains no block with le < headingLevel
 *       (the "stack empties" case in STACK-ATTACH §5.2), the fallback
 *       must be semantically correct, not just "return last block."
 *
 * DRY: All 7 callers manually compute endBlockPos - (shouldNested ? 2 : 0).
 *      Extract to getInsertionPos helper.
 *
 * SOLID: Callers use prevBlock! (non-null assertion). Must handle null safely.
 */

import { findPrevBlock, getInsertionPos } from '../helper'
import { HeadingBlockInfo, PrevBlockResult } from '../types'

// ============================================================================
// E-2: Fallback behavior when heading is ABOVE the map
// ============================================================================

describe('E-2: findPrevBlock fallback for heading above scope', () => {
  const allH3Map: HeadingBlockInfo[] = [
    { le: 3, depth: 4, startBlockPos: 100, endBlockPos: 150 },
    { le: 3, depth: 4, startBlockPos: 150, endBlockPos: 200 },
    { le: 3, depth: 4, startBlockPos: 200, endBlockPos: 250 }
  ]

  it('H2 into [H3,H3,H3]: prevBlock should be FIRST block, not last', () => {
    const result = findPrevBlock(allH3Map, 2)
    // H2 is structurally ABOVE all H3s — it should go BEFORE them
    expect(result.prevBlock).toEqual(allH3Map[0])
    expect(result.shouldNested).toBe(false)
  })

  it('H4 into [H5,H6,H7]: prevBlock should be first block (H4 < min level 5)', () => {
    const map: HeadingBlockInfo[] = [
      { le: 5, depth: 4, startBlockPos: 100, endBlockPos: 150 },
      { le: 6, depth: 6, startBlockPos: 150, endBlockPos: 200 },
      { le: 7, depth: 8, startBlockPos: 200, endBlockPos: 250 }
    ]
    const result = findPrevBlock(map, 4)
    expect(result.prevBlock).toEqual(map[0])
    expect(result.shouldNested).toBe(false)
  })

  it('H1 into [H3,H3] still uses last block (H1 is root, callers handle specially)', () => {
    const map: HeadingBlockInfo[] = [
      { le: 3, depth: 4, startBlockPos: 100, endBlockPos: 150 },
      { le: 3, depth: 4, startBlockPos: 150, endBlockPos: 200 }
    ]
    const result = findPrevBlock(map, 1)
    // H1 always falls to generic fallback — callers handle root-level insertion
    expect(result.prevBlock).toEqual(map[map.length - 1])
    expect(result.shouldNested).toBe(false)
  })
})

// ============================================================================
// Same-level sibling detection in fallback
// ============================================================================

describe('findPrevBlock fallback: same-level sibling detection', () => {
  it('H3 into [H3,H3,H3]: uses LAST same-level block as sibling', () => {
    const map: HeadingBlockInfo[] = [
      { le: 3, depth: 4, startBlockPos: 100, endBlockPos: 150 },
      { le: 3, depth: 4, startBlockPos: 150, endBlockPos: 200 },
      { le: 3, depth: 4, startBlockPos: 200, endBlockPos: 250 }
    ]
    const result = findPrevBlock(map, 3)
    expect(result.prevBlock).toEqual(map[2]) // last H3
    expect(result.shouldNested).toBe(false)
  })

  it('H5 into [H3,H5,H3,H5]: uses last H3 as parent (findLast le < 5)', () => {
    const map: HeadingBlockInfo[] = [
      { le: 3, depth: 4, startBlockPos: 100, endBlockPos: 150 },
      { le: 5, depth: 6, startBlockPos: 150, endBlockPos: 200 },
      { le: 3, depth: 4, startBlockPos: 200, endBlockPos: 250 },
      { le: 5, depth: 6, startBlockPos: 250, endBlockPos: 300 }
    ]
    const result = findPrevBlock(map, 5)
    // findLast(le < 5) → second H3 at pos 200
    expect(result.prevBlock).toEqual(map[2])
    expect(result.shouldNested).toBe(true)
  })
})

// ============================================================================
// DRY: getInsertionPos helper
// ============================================================================

describe('getInsertionPos helper (DRY)', () => {
  it('returns endBlockPos - 2 when shouldNested is true', () => {
    const result: PrevBlockResult = {
      prevBlock: { le: 1, depth: 0, startBlockPos: 0, endBlockPos: 500 },
      shouldNested: true
    }
    expect(getInsertionPos(result)).toBe(498)
  })

  it('returns endBlockPos when shouldNested is false', () => {
    const result: PrevBlockResult = {
      prevBlock: { le: 3, depth: 4, startBlockPos: 100, endBlockPos: 200 },
      shouldNested: false
    }
    expect(getInsertionPos(result)).toBe(200)
  })

  it('returns null when prevBlock is null', () => {
    const result: PrevBlockResult = {
      prevBlock: null,
      shouldNested: false
    }
    expect(getInsertionPos(result)).toBeNull()
  })
})

// ============================================================================
// SOLID: Structural assertions on callers — no ! assertions on prevBlock
// ============================================================================

describe('SOLID: callers must not use non-null assertions on prevBlock', () => {
  const callerFiles = [
    'src/components/TipTap/extensions/wrapContentWithHeading.ts',
    'src/components/TipTap/extensions/changeHeadingLevel-forward.ts',
    'src/components/TipTap/extensions/changeHeadingLevel-backward.ts',
    'src/components/TipTap/extensions/changeHeadingLevel-h1.ts',
    'src/components/TipTap/extensions/normalText/onHeading.ts'
  ]

  it.each(callerFiles)('%s must not use prevBlock! (non-null assertion)', async (filePath) => {
    const fs = await import('fs')
    const content = fs.readFileSync(filePath, 'utf-8')
    // Must not have prevBlock! followed by .endBlockPos or .startBlockPos
    expect(content).not.toMatch(/prevBlock!\.(endBlockPos|startBlockPos|le|depth)/)
  })

  it('headingMap.ts exports getInsertionPos helper', async () => {
    const fs = await import('fs')
    const content = fs.readFileSync(
      'src/components/TipTap/extensions/helper/headingMap.ts',
      'utf-8'
    )
    expect(content).toContain('export const getInsertionPos')
  })
})

// ============================================================================
// Backward compatibility: existing behavior must be preserved
// ============================================================================

describe('findPrevBlock backward compatibility', () => {
  const standardMap: HeadingBlockInfo[] = [
    { le: 1, depth: 0, startBlockPos: 0, endBlockPos: 500 },
    { le: 2, depth: 2, startBlockPos: 50, endBlockPos: 450 },
    { le: 3, depth: 4, startBlockPos: 100, endBlockPos: 400 }
  ]

  it('normal case: H4 finds H3 as parent', () => {
    const result = findPrevBlock(standardMap, 4)
    expect(result.prevBlock).toEqual(standardMap[2])
    expect(result.shouldNested).toBe(true)
    expect(getInsertionPos(result)).toBe(398) // 400 - 2
  })

  it('normal case: H2 finds H1 as parent', () => {
    const result = findPrevBlock(standardMap, 2)
    expect(result.prevBlock).toEqual(standardMap[0])
    expect(result.shouldNested).toBe(true)
    expect(getInsertionPos(result)).toBe(498) // 500 - 2
  })

  it('empty map returns null', () => {
    const result = findPrevBlock([], 5)
    expect(result.prevBlock).toBeNull()
    expect(result.shouldNested).toBe(false)
    expect(getInsertionPos(result)).toBeNull()
  })

  it('single H1: H3 nests inside', () => {
    const map: HeadingBlockInfo[] = [{ le: 1, depth: 0, startBlockPos: 0, endBlockPos: 200 }]
    const result = findPrevBlock(map, 3)
    expect(result.prevBlock).toEqual(map[0])
    expect(result.shouldNested).toBe(true)
    expect(getInsertionPos(result)).toBe(198)
  })
})
